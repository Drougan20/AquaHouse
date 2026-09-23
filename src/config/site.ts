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
    'A comfortable place to share time together. Explore the house, picture your stay and get in touch about your dates.',

  about:
    'A whole house to enjoy at your own pace. Add a short description here about what makes your property special.',

  
  whatsappNumber: '27799149415',
  callNumber: '0799149415',
  contactEmail: 'aquahouse97@gmail.com',

  photos: {
    hero: {
      src: '',
      alt: '',
    },

    gallery: [
      { src: '', alt: '' },
      { src: '', alt: '' },
      { src: '', alt: '' },
      { src: '', alt: '' },
    ],
  },
} satisfies SiteContent;