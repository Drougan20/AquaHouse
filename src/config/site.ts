export type SitePhoto = {
  src: string;
  alt: string;
};

export type SiteContent = {
  name: string;
  area: string;
  intro: string;
  about: string;
  whatsappNumber: string;
  callNumber: string;
  contactEmail: string;
  photos: {
    hero: SitePhoto;
    gallery: SitePhoto[];
  };
};

export const site = {
  name: 'Aqua House',
  area: 'Milnerton',

  intro:
    'Stay at Aqua House, a private four-bedroom house in Milnerton, Cape Town. Sleeps up to 12 guests, with a pool, entertainment area and gym.',

  about:
    'A spacious whole-house stay for family and friends, with room to relax by the pool, share a meal and enjoy Cape Town at your own pace.',

  whatsappNumber: '27799149415',
  callNumber: '0799149415',
  contactEmail: 'aquahouse97@gmail.com',

  photos: {
    hero: {
      src: 'DSC09176.jpg',
      alt: 'Aqua House in Milnerton, Cape Town',
    },

    // An empty list uses the photos already in src/assets/photos/.
    gallery: [],
  },
} satisfies SiteContent;