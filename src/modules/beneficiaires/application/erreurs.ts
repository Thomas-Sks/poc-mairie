/** Erreurs métier remontées aux adaptateurs entrants (affichées telles quelles à l'utilisateur). */
export class ErreurMetier extends Error {
  constructor(
    message: string,
    public readonly champs: Partial<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}

export class FicheIntrouvable extends ErreurMetier {
  constructor() {
    super("Cette fiche est introuvable.");
    this.name = "FicheIntrouvable";
  }
}
