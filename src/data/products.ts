const tobaccoPlaceholderImg = "/placeholder.svg";

export interface Product {
  id: string;
  itemNumber: string;
  name: string;
  description: string;
  mrp: number;
  srp: number;
  moq: number;
  packSize: string;
  image: string;
  category: "cigarette" | "loose" | "smokeless";
}

export const products: Product[] = [
  {
    id: "filter-kings-20",
    itemNumber: "0001",
    name: "Filter Kings 20s",
    description: "Full flavor filter cigarettes for regular retail movement",
    mrp: 240,
    srp: 220,
    moq: 10,
    packSize: "20 sticks",
    image: tobaccoPlaceholderImg,
    category: "cigarette",
  },
  {
    id: "classic-mild-20",
    itemNumber: "0002",
    name: "Classic Mild 20s",
    description: "Smooth blend filter cigarettes with balanced strength",
    mrp: 260,
    srp: 238,
    moq: 10,
    packSize: "20 sticks",
    image: tobaccoPlaceholderImg,
    category: "cigarette",
  },
  {
    id: "regular-filter-10",
    itemNumber: "0003",
    name: "Regular Filter 10s",
    description: "Value segment filter cigarettes in 10-stick format",
    mrp: 140,
    srp: 128,
    moq: 20,
    packSize: "10 sticks",
    image: tobaccoPlaceholderImg,
    category: "cigarette",
  },
  {
    id: "rolling-tobacco-pouch",
    itemNumber: "0004",
    name: "Rolling Tobacco Pouch",
    description: "Fine-cut rolling tobacco for licensed counter sales",
    mrp: 320,
    srp: 295,
    moq: 6,
    packSize: "50 g pouch",
    image: tobaccoPlaceholderImg,
    category: "loose",
  },
  {
    id: "chewing-tobacco-box",
    itemNumber: "0005",
    name: "Chewing Tobacco Sachet Box",
    description: "Retail-ready box of sealed chewing tobacco sachets",
    mrp: 260,
    srp: 240,
    moq: 8,
    packSize: "25 sachets",
    image: tobaccoPlaceholderImg,
    category: "smokeless",
  },
];
