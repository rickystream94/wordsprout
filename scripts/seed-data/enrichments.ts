import type { RawEnrichment } from './generators.js';

/**
 * Sample enrichment data keyed by phrasebook name.
 * Covers ~30% of entries with example sentences, synonyms, etc.
 */
export const enrichments: Record<string, RawEnrichment[]> = {
  'Italian Essentials': [
    {
      entryIndex: 0, // hello → ciao
      exampleSentences: ['Ciao, come stai?', 'Ciao a tutti!'],
      synonyms: ['salve'],
      antonyms: ['arrivederci'],
      register: 'informal',
      collocations: ['ciao bella', 'ciao ciao'],
    },
    {
      entryIndex: 12, // coffee → caffè
      exampleSentences: ['Vorrei un caffè, per favore.', 'Il caffè italiano è molto forte.'],
      synonyms: ['espresso'],
      antonyms: [],
      register: 'neutral',
      collocations: ['caffè macchiato', 'caffè lungo', 'pausa caffè'],
    },
    {
      entryIndex: 20, // to eat → mangiare
      exampleSentences: ['Andiamo a mangiare fuori stasera.', 'Mi piace mangiare la pizza.'],
      synonyms: ['consumare', 'pranzare'],
      antonyms: ['digiunare'],
      register: 'neutral',
      collocations: ['mangiare bene', 'mangiare fuori', 'dare da mangiare'],
    },
    {
      entryIndex: 29, // beautiful → bello
      exampleSentences: ['Che bello!', 'Roma è una bella città.'],
      synonyms: ['carino', 'attraente', 'splendido'],
      antonyms: ['brutto'],
      register: 'neutral',
      collocations: ['bel tempo', 'bella figura', 'il bel paese'],
    },
  ],
  'Spanish Basics': [
    {
      entryIndex: 0, // hello → hola
      exampleSentences: ['¡Hola! ¿Qué tal?', 'Hola, me llamo Carlos.'],
      synonyms: ['buenas', 'qué hay'],
      antonyms: ['adiós'],
      register: 'informal',
      collocations: ['hola a todos', 'hola buenos días'],
    },
    {
      entryIndex: 15, // to eat → comer
      exampleSentences: ['Vamos a comer a las dos.', 'Me gusta comer frutas frescas.'],
      synonyms: ['alimentarse', 'almorzar'],
      antonyms: ['ayunar'],
      register: 'neutral',
      collocations: ['comer fuera', 'dar de comer', 'comer bien'],
    },
    {
      entryIndex: 24, // to know → saber
      exampleSentences: ['¿Sabes dónde está la biblioteca?', 'No sé la respuesta.'],
      synonyms: ['conocer', 'entender'],
      antonyms: ['ignorar', 'desconocer'],
      register: 'neutral',
      collocations: ['saber de memoria', 'saber a', 'que yo sepa'],
      falseFriendWarning: 'saber = know facts; conocer = know people/places',
    },
    {
      entryIndex: 35, // hot → caliente
      exampleSentences: ['La sopa está muy caliente.', 'Hoy hace un día caliente.'],
      synonyms: ['cálido', 'ardiente'],
      antonyms: ['frío', 'helado'],
      register: 'neutral',
      collocations: ['agua caliente', 'perro caliente'],
    },
  ],
  'French Foundations': [
    {
      entryIndex: 0, // hello → bonjour
      exampleSentences: ['Bonjour, comment allez-vous ?', 'Bonjour madame, je voudrais un café.'],
      synonyms: ['salut', 'bonsoir'],
      antonyms: ['au revoir'],
      register: 'neutral',
      collocations: ['bonjour monsieur', 'bonjour madame'],
    },
    {
      entryIndex: 17, // to eat → manger
      exampleSentences: ['On va manger au restaurant ce soir.', 'Les enfants aiment manger des bonbons.'],
      synonyms: ['consommer', 'déguster', 'se nourrir'],
      antonyms: ['jeûner'],
      register: 'neutral',
      collocations: ['manger bien', 'salle à manger', 'donner à manger'],
    },
    {
      entryIndex: 28, // to love → aimer
      exampleSentences: ["J'aime la musique classique.", 'Elle aime voyager.'],
      synonyms: ['adorer', 'affectionner'],
      antonyms: ['détester', 'haïr'],
      register: 'neutral',
      collocations: ["aimer bien", "aimer mieux", "s'aimer"],
    },
  ],
  'German Starter': [
    {
      entryIndex: 0, // hello → hallo
      exampleSentences: ['Hallo, wie geht es Ihnen?', 'Hallo zusammen!'],
      synonyms: ['guten Tag', 'servus', 'moin'],
      antonyms: ['tschüss', 'auf Wiedersehen'],
      register: 'informal',
      collocations: ['hallo sagen'],
    },
    {
      entryIndex: 16, // to eat → essen
      exampleSentences: ['Wir gehen heute Abend essen.', 'Ich esse gern Brot mit Käse.'],
      synonyms: ['speisen', 'sich ernähren'],
      antonyms: ['fasten', 'hungern'],
      register: 'neutral',
      collocations: ['zu Mittag essen', 'zu Abend essen', 'essen gehen'],
    },
    {
      entryIndex: 33, // beautiful → schön
      exampleSentences: ['Das Wetter ist heute sehr schön.', 'Sie hat ein schönes Lächeln.'],
      synonyms: ['hübsch', 'wunderschön', 'attraktiv'],
      antonyms: ['hässlich'],
      register: 'neutral',
      collocations: ['schönes Wetter', 'schöne Grüße'],
    },
  ],
  'Japanese Phrases': [
    {
      entryIndex: 0, // hello → こんにちは
      exampleSentences: ['こんにちは、お元気ですか？', 'こんにちは、はじめまして。'],
      synonyms: ['やあ', 'どうも'],
      antonyms: ['さようなら'],
      register: 'neutral',
      collocations: ['こんにちは皆さん'],
    },
    {
      entryIndex: 15, // to eat → 食べる
      exampleSentences: ['朝ごはんを食べましたか？', '一緒に食べましょう。'],
      synonyms: ['召し上がる', 'いただく'],
      antonyms: [],
      register: 'neutral',
      collocations: ['ご飯を食べる', '食べ物', '食べ放題'],
    },
    {
      entryIndex: 26, // big → 大きい
      exampleSentences: ['この部屋は大きいです。', '大きい声で話してください。'],
      synonyms: ['巨大な', 'でかい'],
      antonyms: ['小さい'],
      register: 'neutral',
      collocations: ['大きい声', '大きい問題'],
    },
  ],
  'Portuguese Travel': [
    {
      entryIndex: 0, // hello → olá
      exampleSentences: ['Olá, tudo bem?', 'Olá, como está?'],
      synonyms: ['oi', 'e aí'],
      antonyms: ['tchau', 'adeus'],
      register: 'informal',
      collocations: ['olá pessoal'],
    },
    {
      entryIndex: 17, // to eat → comer
      exampleSentences: ['Vamos comer fora hoje.', 'Eu gosto de comer peixe fresco.'],
      synonyms: ['alimentar-se', 'jantar', 'almoçar'],
      antonyms: ['jejuar'],
      register: 'neutral',
      collocations: ['comer fora', 'dar de comer', 'comer bem'],
    },
    {
      entryIndex: 28, // beach → praia
      exampleSentences: ['Vamos à praia amanhã?', 'A praia estava cheia de gente.'],
      synonyms: ['litoral', 'costa'],
      antonyms: [],
      register: 'neutral',
      collocations: ['ir à praia', 'praia de areia', 'toalha de praia'],
    },
  ],
};
