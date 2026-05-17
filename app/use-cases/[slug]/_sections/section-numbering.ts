export function templateOrProductNextNumber(
  hasProduct: boolean,
  hasTemplate: boolean,
) {
  if (hasProduct && hasTemplate) return "XI";
  if (hasProduct || hasTemplate) return "X";
  return "IX";
}

export function rawNumber(hasProduct: boolean, hasTemplate: boolean) {
  if (hasProduct && hasTemplate) return "XII";
  if (hasProduct || hasTemplate) return "XI";
  return "X";
}

/** FedRAMP coverage section sits at the very end of the main column,
 *  one number past the Raw record. */
export function fedrampNumber(hasProduct: boolean, hasTemplate: boolean) {
  if (hasProduct && hasTemplate) return "XIII";
  if (hasProduct || hasTemplate) return "XII";
  return "XI";
}
