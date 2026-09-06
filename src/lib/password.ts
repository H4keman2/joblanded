// Shared password policy for signup and password changes. Kept simple and
// explainable rather than a full entropy calculator: a length floor plus "not
// just letters" catches the common weak cases (short dictionary words, pure
// digits) without being strict enough to lock someone out of a reasonable
// passphrase.
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters, with a mix of letters and at least one number or symbol.`;

/** Returns a user-facing error message if the password is too weak, or null if it's fine. */
export function passwordIssue(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[^a-zA-Z]/.test(password);
  if (!hasLetter || !hasNumberOrSymbol) {
    return "Password must include a mix of letters and at least one number or symbol.";
  }
  return null;
}
