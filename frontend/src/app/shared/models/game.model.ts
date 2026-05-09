export interface Game {
  id: number;
  name: string;
  slug: string;
  nexus_domain: string;
  image_url?: string;
  versions?: string[];
}

export interface Playstyle {
  id: number;
  game_id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}
