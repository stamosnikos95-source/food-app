import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const items = [
  {
    name: "Bowl κοτόπουλο & κινόα",
    description: "Ψητό κοτόπουλο, κινόα, avocado, cherry ντομάτες, sauce γιαουρτιού",
    priceCents: 850,
    portionWeightG: 420,
    calories: 540,
    proteinG: 42,
    carbsG: 48,
    fatG: 18,
  },
  {
    name: "Σολομός με γλυκοπατάτα",
    description: "Ψητός σολομός, πουρές γλυκοπατάτας, μπρόκολο ατμού",
    priceCents: 980,
    portionWeightG: 400,
    calories: 610,
    proteinG: 38,
    carbsG: 42,
    fatG: 28,
  },
  {
    name: "Vegan bowl με φακές",
    description: "Φακές, καστανό ρύζι, λαχανικά, ταχίνι",
    priceCents: 750,
    portionWeightG: 400,
    calories: 480,
    proteinG: 22,
    carbsG: 68,
    fatG: 14,
  },
  {
    name: "Salad ελληνική με κοτόπουλο",
    description: "Ντομάτα, αγγούρι, φέτα, ελιές, ψητό κοτόπουλο, ελαιόλαδο",
    priceCents: 800,
    portionWeightG: 380,
    calories: 460,
    proteinG: 34,
    carbsG: 18,
    fatG: 28,
  },
  {
    name: "Wrap γαλοπούλα & λαχανικά",
    description: "Ολικής άλεσης wrap, γαλοπούλα, λαχανικά, avocado",
    priceCents: 700,
    portionWeightG: 320,
    calories: 420,
    proteinG: 30,
    carbsG: 40,
    fatG: 14,
  },
  {
    name: "Buddha bowl λαχανικών",
    description: "Εποχιακά ψητά λαχανικά, χούμους, κινόα, σπόροι",
    priceCents: 780,
    portionWeightG: 400,
    calories: 500,
    proteinG: 18,
    carbsG: 60,
    fatG: 20,
  },
];

async function main() {
  for (const item of items) {
    await prisma.menuItem.upsert({
      where: { id: `seed-${item.name}` },
      update: item,
      create: { id: `seed-${item.name}`, ...item },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${items.length} menu items`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
