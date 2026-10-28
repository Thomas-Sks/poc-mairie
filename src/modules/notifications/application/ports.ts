import type { MembreEquipe, Notification, TypeNotification } from "../domain/notification";

export type NouvelleNotification = {
  destinataireId: string;
  type: TypeNotification;
  titre: string;
  message: string | null;
  lien: string | null;
};

export interface NotificationRepository {
  lister(communeId: string, destinataireId: string, limite: number): Promise<Notification[]>;
  compterNonLues(communeId: string, destinataireId: string): Promise<number>;
  marquerLue(communeId: string, destinataireId: string, id: string): Promise<void>;
  marquerToutesLues(communeId: string, destinataireId: string): Promise<void>;
  creer(communeId: string, notifications: NouvelleNotification[]): Promise<void>;
  equipe(communeId: string): Promise<MembreEquipe[]>;
}
