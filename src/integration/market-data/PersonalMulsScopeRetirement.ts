export const PERSONAL_MULS_SCOPE_RETIREMENT_CODE =
  "MULS_RETIRED_FROM_ACTIVE_SCOPE" as const;

export const PERSONAL_MULS_SCOPE_RETIRED_AT =
  "2026-07-29T15:30:00.000Z" as const;

export class PersonalMulsScopeRetiredError extends Error {
  public readonly safeCode = PERSONAL_MULS_SCOPE_RETIREMENT_CODE;

  public constructor() {
    super("MULS has been retired from the active personal market-data scope.");
    this.name = "PersonalMulsScopeRetiredError";
  }

  public toJSON(): Readonly<{
    code: typeof PERSONAL_MULS_SCOPE_RETIREMENT_CODE;
    retiredAt: typeof PERSONAL_MULS_SCOPE_RETIRED_AT;
  }> {
    return Object.freeze({
      code: this.safeCode,
      retiredAt: PERSONAL_MULS_SCOPE_RETIRED_AT,
    });
  }
}

export function rejectRetiredPersonalMulsLiveOperation(): never {
  throw new PersonalMulsScopeRetiredError();
}
