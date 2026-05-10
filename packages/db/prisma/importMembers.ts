#!/usr/bin/env bun

/**
 * Idempotent member import from a normalized CSV.
 *
 * Expected columns (header row required, others ignored):
 *   name      display name
 *   email     pseudo email (deterministic per source row, e.g. <e164-digits>@whatsapp.tribe)
 *   whatsapp  E.164 phone (e.g. +972547895443) — empty when source had no parseable number
 *   linkedin  canonical LinkedIn URL — optional
 *   groups    ;-separated ChatGroup.name values (must match seeded ChatGroup names)
 *
 * Per row this upserts:
 *   - User                            (keyed on email)
 *   - Contact { type: whatsapp }      (keyed on User + jid)
 *   - Contact { type: linkedin }      (keyed on User + classifier:handle)
 *   - ChatGroupUser per matched group (keyed on userId + chatGroupId)
 *
 * Re-running is safe: existing rows are detected and skipped/updated, never
 * duplicated. Unmatched group names and LinkedIn parse failures are reported
 * at the end as warnings.
 *
 * Usage:
 *   bun run with local api bun run packages/db/prisma/importMembers.ts <path-to-csv>
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { parseLinkedinUrl } from '@template/shared/contact/parsers';
import { LogScope, log } from '@template/shared/logger';
import { uuidv7 } from 'uuidv7';

type Row = {
  name: string;
  email: string;
  whatsapp: string;
  linkedin: string;
  groupNames: string[];
};

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  out.push(cell);
  return out;
};

const parseCsv = (text: string): Row[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  if (!header.includes('email')) {
    throw new Error(`CSV is missing required column "email". Found: ${header.join(', ')}`);
  }
  const idx = (name: string) => header.indexOf(name);

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]).map((c) => c.trim());
    const email = cells[idx('email')]?.toLowerCase();
    if (!email) continue;
    rows.push({
      name: idx('name') >= 0 ? cells[idx('name')] : '',
      email,
      whatsapp: idx('whatsapp') >= 0 ? cells[idx('whatsapp')] : '',
      linkedin: idx('linkedin') >= 0 ? cells[idx('linkedin')] : '',
      groupNames:
        idx('groups') >= 0
          ? cells[idx('groups')].split(';').map((g) => g.trim()).filter(Boolean)
          : [],
    });
  }
  return rows;
};

const whatsappJid = (e164: string): string => `${e164.replace('+', '')}@s.whatsapp.net`;

const importMembers = async (csvPath: string) => {
  const env = process.env.ENVIRONMENT || process.env.NODE_ENV;
  log.info(`Importing members from ${csvPath} (env=${env})`, LogScope.seed);

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  log.info(`Parsed ${rows.length} rows`, LogScope.seed);

  const groups = await db.chatGroup.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));

  let usersCreated = 0;
  let usersUpdated = 0;
  let usersUnchanged = 0;
  let whatsappCreated = 0;
  let whatsappExisting = 0;
  let linkedinCreated = 0;
  let linkedinExisting = 0;
  let linkedinSkipped = 0;
  let membershipsCreated = 0;
  let membershipsExisting = 0;
  const unknownGroupNames = new Set<string>();
  const linkedinParseFailures: string[] = [];

  for (const row of rows) {
    // --- User -------------------------------------------------------------
    const existingUser = await db.user.findUnique({ where: { email: row.email } });
    let userId: string;
    if (existingUser) {
      if (row.name && row.name !== existingUser.name) {
        await db.user.update({ where: { id: existingUser.id }, data: { name: row.name } });
        usersUpdated++;
      } else {
        usersUnchanged++;
      }
      userId = existingUser.id;
    } else {
      const created = await db.user.create({
        data: { id: uuidv7(), email: row.email, name: row.name || null, emailVerified: false },
      });
      userId = created.id;
      usersCreated++;
    }

    // --- WhatsApp Contact -------------------------------------------------
    if (row.whatsapp) {
      const jid = whatsappJid(row.whatsapp);
      const existing = await db.contact.findFirst({
        where: { ownerModel: ContactOwnerModel.User, userId, type: ContactType.whatsapp, valueKey: jid },
      });
      if (existing) {
        whatsappExisting++;
      } else {
        await db.contact.create({
          data: {
            id: uuidv7(),
            ownerModel: ContactOwnerModel.User,
            userId,
            type: ContactType.whatsapp,
            valueKey: jid,
            value: { jid, displayName: row.name || undefined },
          },
        });
        whatsappCreated++;
      }
    }

    // --- LinkedIn Contact -------------------------------------------------
    if (row.linkedin) {
      try {
        const parsed = parseLinkedinUrl(row.linkedin);
        const valueKey = `${parsed.classifier}:${parsed.handle.toLowerCase()}`;
        const existing = await db.contact.findFirst({
          where: { ownerModel: ContactOwnerModel.User, userId, type: ContactType.linkedin, valueKey },
        });
        if (existing) {
          linkedinExisting++;
        } else {
          await db.contact.create({
            data: {
              id: uuidv7(),
              ownerModel: ContactOwnerModel.User,
              userId,
              type: ContactType.linkedin,
              valueKey,
              value: { classifier: parsed.classifier, handle: parsed.handle },
            },
          });
          linkedinCreated++;
        }
      } catch (err) {
        linkedinSkipped++;
        linkedinParseFailures.push(`${row.email} → ${row.linkedin} (${(err as Error).message})`);
      }
    }

    // --- ChatGroupUser ----------------------------------------------------
    for (const groupName of row.groupNames) {
      const chatGroupId = groupIdByName.get(groupName);
      if (!chatGroupId) {
        unknownGroupNames.add(groupName);
        continue;
      }
      const existing = await db.chatGroupUser.findUnique({
        where: { userId_chatGroupId: { userId, chatGroupId } },
      });
      if (existing) {
        membershipsExisting++;
      } else {
        await db.chatGroupUser.create({
          data: { id: uuidv7(), userId, chatGroupId, joinedAt: new Date() },
        });
        membershipsCreated++;
      }
    }
  }

  log.success(
    `Users — created: ${usersCreated}, updated: ${usersUpdated}, unchanged: ${usersUnchanged}`,
    LogScope.seed,
  );
  log.success(
    `WhatsApp Contacts — created: ${whatsappCreated}, already-present: ${whatsappExisting}`,
    LogScope.seed,
  );
  log.success(
    `LinkedIn Contacts — created: ${linkedinCreated}, already-present: ${linkedinExisting}, parse-failed: ${linkedinSkipped}`,
    LogScope.seed,
  );
  log.success(
    `ChatGroupUsers — created: ${membershipsCreated}, already-present: ${membershipsExisting}`,
    LogScope.seed,
  );
  if (unknownGroupNames.size > 0) {
    log.warn(
      `Unmatched group names (skipped — check spelling against chatGroup.seed.ts): ${[
        ...unknownGroupNames,
      ].join(', ')}`,
      LogScope.seed,
    );
  }
  if (linkedinParseFailures.length > 0) {
    log.warn(
      `LinkedIn URLs that failed to parse (Contact skipped, User still imported): ${linkedinParseFailures
        .slice(0, 5)
        .join('; ')}${linkedinParseFailures.length > 5 ? ` (+${linkedinParseFailures.length - 5} more)` : ''}`,
      LogScope.seed,
    );
  }
};

const csvArg = process.argv[2];
if (!csvArg) {
  log.error('Usage: importMembers.ts <path-to-csv>', LogScope.seed);
  process.exit(1);
}

importMembers(resolve(csvArg))
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Import failed:', LogScope.seed);
    console.error(error);
    process.exit(1);
  });
