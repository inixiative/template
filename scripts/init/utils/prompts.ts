/**
 * Composable prompt system for TUI
 *
 * Define available commands and compose them in consistent order
 */

type Command =
	| 'navigate'    // Use ↑/↓ to navigate
	| 'select'      // Enter to select
	| 'enter'       // Enter to continue/proceed (generic primary action)
	| 'restart'     // R to restart
	| 'cancel'      // Esc to cancel
	| 'exit';       // Ctrl+C to exit

const COMMAND_TEXT: Record<Command, string> = {
	navigate: 'Use ↑/↓ to navigate',
	select: 'Enter to select',
	enter: 'Enter to continue',
	restart: 'R to restart',
	cancel: 'Esc to cancel',
	exit: 'Ctrl+C to exit',
};

// Order of precedence (earlier = appears first)
const COMMAND_ORDER: Command[] = [
	'navigate',
	'select',
	'enter',
	'restart',
	'cancel',
	'exit',
];

/**
 * Build a prompt message from a set of commands
 * Commands are automatically ordered and formatted consistently
 *
 * @example
 * prompt(['continue', 'cancel']) // => "Press Enter to continue, Esc to cancel"
 * prompt(['navigate', 'select']) // => "Use ↑/↓ to navigate, Enter to select"
 * prompt(['navigate', 'select', 'cancel']) // => "Use ↑/↓ to navigate, Enter to select, Esc to cancel"
 */
export function prompt(commands: Command[]): string {
	// Sort by defined order
	const sorted = commands.sort((a, b) => {
		return COMMAND_ORDER.indexOf(a) - COMMAND_ORDER.indexOf(b);
	});

	// Build prompt text
	const parts = sorted.map(cmd => COMMAND_TEXT[cmd]);

	// Format with "Press" prefix if not starting with "Use"
	const text = parts.join(', ');
	return text.startsWith('Use') ? text : `Press ${text}`;
}

export type { Command };
