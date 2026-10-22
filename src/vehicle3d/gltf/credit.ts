/** Credit the model licence requires, shown in About. */
export interface GltfCredit {
  /** model title on Sketchfab */
  title: string;
  author: string;
  authorUrl: string;
  license: string;
  licenseUrl: string;
}

export interface GltfCar {
  /** file in public/models/ (several catalog cars may share one model, e.g. Golf variants) */
  file: string;
  credit: GltfCredit;
}

const DDIAZ = { author: 'Ddiaz Design', authorUrl: 'https://sketchfab.com/ddiaz-design' };
const BY_NC_SA = {
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};
export const ddiaz = (file: string, title: string): GltfCar => ({
  file,
  credit: { title, ...DDIAZ, ...BY_NC_SA },
});
