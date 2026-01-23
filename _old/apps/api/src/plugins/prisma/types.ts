import { PrismaClient } from '@prisma/client';

export type PrismaInterface = PrismaClient | TxClient;

export type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;