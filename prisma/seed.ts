import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const languages = [
    { name: 'English' },
    { name: 'Hindi' },
    { name: 'Marathi' },
    { name: 'Gujarati' },
    { name: 'Kannada' },
    { name: 'Telugu' },
    { name: 'Tamil' },
    { name: 'Malayalam' },
    { name: 'Punjabi' },
    { name: 'Bengali' },
    { name: 'Urdu' },
    { name: 'Assamese' },
    { name: 'Oriya' },
  ];

  console.log('Start seeding languages...');

  for (const language of languages) {
    const existingLanguage = await prisma.languages.findUnique({
      where: { name: language.name },
    });

    if (!existingLanguage) {
      await prisma.languages.create({
        data: language,
      });
      console.log(`Created language: ${language.name}`);
    } else {
      console.log(`Language ${language.name} already exists`);
    }
  }

  console.log('Seeding languages finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
