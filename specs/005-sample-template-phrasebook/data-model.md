# Data Model: Sample Template Phrasebook

**Branch**: `feature/005-sample-template-phrasebook`

---

## Overview

This feature requires:
1. A **schema extension** to `Phrasebook` and `DBPhrasebook` to carry the `fromTemplate` origin flag.
2. A **new static data module** (`templatePhrasebooks.ts`) holding the 50 hardcoded vocabulary entries with translations in 10 languages.
3. No new Dexie schema version is required (no new indexed columns); `fromTemplate` is stored as an unindexed field.
4. No new Cosmos DB containers are required; `fromTemplate` round-trips as a document field.

---

## 1. Extended `Phrasebook` (API — `api/src/models/types.ts`)

```ts
export interface Phrasebook extends CosmosDocument {
  type: 'phrasebook';
  name: string;
  sourceLanguageCode: string;  // ISO 639-1
  sourceLanguageName: string;
  targetLanguageCode: string;  // ISO 639-1
  targetLanguageName: string;
  entryCount: number;
  fromTemplate?: boolean;      // NEW: true when created via template generation
}
```

**Constraints**:
- `fromTemplate` is optional (existing documents without the field default to `undefined`, treated as `false` in UI).
- The field is immutable after creation — no API endpoint changes it post-creation.
- Per FR-011, the combination `(userId, sourceLanguageCode, targetLanguageCode)` must be unique across all phrasebooks for a user.

---

## 2. Extended `DBPhrasebook` (Frontend — `frontend/src/services/db.ts`)

```ts
export interface DBPhrasebook {
  id: string;
  userId: string;
  name: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
  fromTemplate?: boolean;      // NEW: mirrors API field
}
```

---

## 3. `TemplateEntry` (Frontend — `frontend/src/data/templatePhrasebooks.ts`)

This type exists only at build-time / in static data; it is never stored in IndexedDB or Cosmos DB directly. It is used to construct `DBEntry` + `DBEnrichment` instances at generation time.

```ts
export interface TemplateEntry {
  sourceText: string;                       // English word/phrase
  partOfSpeech: PartOfSpeech;
  tags: string[];                           // e.g. ['greetings', 'social']
  translations: Record<string, string>;     // ISO 639-1 → translated text
  enrichment: {
    exampleSentences: string[];             // 1–2 English-language example sentences
    synonyms: string[];                     // English synonyms
    collocations: string[];                 // Common collocations in English
  };
}
```

**Field rules**:
- `translations` must contain a key for every code in `TEMPLATE_LANGUAGE_CODES`.
- `tags` must contain at least one value.
- `enrichment.exampleSentences` must contain at least one entry.

---

## 4. Static Constants (`frontend/src/data/templatePhrasebooks.ts`)

```ts
export const TEMPLATE_LANGUAGE_CODES = ['es', 'pt', 'fr', 'de', 'it', 'ru', 'pl', 'nl', 'ro', 'hi'] as const;
export type TemplateLanguageCode = typeof TEMPLATE_LANGUAGE_CODES[number];

export const TEMPLATE_LANGUAGES: { code: TemplateLanguageCode; name: string }[] = [
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hi', name: 'Hindi' },
];

// 50 hardcoded entries — identical for every user
export const TEMPLATE_ENTRIES: TemplateEntry[] = [ /* … */ ];
```

---

## 5. The 50 Template Vocabulary Entries

Source language is always English (`en`). Entries are grouped by category tag.

### Category: greetings

| # | English | es | pt | fr | de | it | ru | pl | nl | ro | hi |
|---|---------|----|----|----|----|----|----|----|----|----|----|
| 1 | hello | hola | olá | bonjour | hallo | ciao | привет | cześć | hallo | bună | नमस्ते |
| 2 | goodbye | adiós | adeus | au revoir | auf Wiedersehen | arrivederci | до свидания | do widzenia | dag | la revedere | अलविदा |
| 3 | please | por favor | por favor | s'il vous plaît | bitte | per favore | пожалуйста | proszę | alsjeblieft | vă rog | कृपया |
| 4 | thank you | gracias | obrigado | merci | danke | grazie | спасибо | dziękuję | dank je | mulțumesc | धन्यवाद |
| 5 | sorry | lo siento | desculpe | désolé | Entschuldigung | scusa | прости | przepraszam | sorry | îmi pare rău | माफ़ करें |
| 6 | yes | sí | sim | oui | ja | sì | да | tak | ja | da | हाँ |
| 7 | no | no | não | non | nein | no | нет | nie | nee | nu | नहीं |
| 8 | excuse me | perdón | com licença | excusez-moi | Entschuldigung | scusi | извините | przepraszam | excuseer mij | scuzați-mă | क्षमा करें |

### Category: numbers

| # | English | es | pt | fr | de | it | ru | pl | nl | ro | hi |
|---|---------|----|----|----|----|----|----|----|----|----|----|
| 9 | one | uno | um | un | eins | uno | один | jeden | één | unu | एक |
| 10 | two | dos | dois | deux | zwei | due | два | dwa | twee | doi | दो |
| 11 | three | tres | três | trois | drei | tre | три | trzy | drie | trei | तीन |
| 12 | four | cuatro | quatro | quatre | vier | quattro | четыре | cztery | vier | patru | चार |
| 13 | five | cinco | cinco | cinq | fünf | cinque | пять | pięć | vijf | cinci | पाँच |
| 14 | six | seis | seis | six | sechs | sei | шесть | sześć | zes | șase | छह |
| 15 | seven | siete | sete | sept | sieben | sette | семь | siedem | zeven | șapte | सात |
| 16 | eight | ocho | oito | huit | acht | otto | восемь | osiem | acht | opt | आठ |
| 17 | nine | nueve | nove | neuf | neun | nove | девять | dziewięć | negen | nouă | नौ |
| 18 | ten | diez | dez | dix | zehn | dieci | десять | dziesięć | tien | zece | दस |

### Category: colors

| # | English | es | pt | fr | de | it | ru | pl | nl | ro | hi |
|---|---------|----|----|----|----|----|----|----|----|----|----|
| 19 | red | rojo | vermelho | rouge | rot | rosso | красный | czerwony | rood | roșu | लाल |
| 20 | blue | azul | azul | bleu | blau | blu | синий | niebieski | blauw | albastru | नीला |
| 21 | green | verde | verde | vert | grün | verde | зелёный | zielony | groen | verde | हरा |
| 22 | yellow | amarillo | amarelo | jaune | gelb | giallo | жёлтый | żółty | geel | galben | पीला |
| 23 | black | negro | preto | noir | schwarz | nero | чёрный | czarny | zwart | negru | काला |
| 24 | white | blanco | branco | blanc | weiß | bianco | белый | biały | wit | alb | सफ़ेद |

### Category: time

| # | English | es | pt | fr | de | it | ru | pl | nl | ro | hi |
|---|---------|----|----|----|----|----|----|----|----|----|----|
| 25 | today | hoy | hoje | aujourd'hui | heute | oggi | сегодня | dzisiaj | vandaag | astăzi | आज |
| 26 | tomorrow | mañana | amanhã | demain | morgen | domani | завтра | jutro | morgen | mâine | कल |
| 27 | yesterday | ayer | ontem | hier | gestern | ieri | вчера | wczoraj | gisteren | ieri | कल (बीता) |
| 28 | morning | mañana | manhã | matin | Morgen | mattina | утро | rano | ochtend | dimineață | सुबह |
| 29 | evening | tarde | tarde | soir | Abend | sera | вечер | wieczór | avond | seară | शाम |
| 30 | Monday | lunes | segunda-feira | lundi | Montag | lunedì | понедельник | poniedziałek | maandag | luni | सोमवार |
| 31 | Sunday | domingo | domingo | dimanche | Sonntag | domenica | воскресенье | niedziela | zondag | duminică | रविवार |

### Category: food

| # | English | es | pt | fr | de | it | ru | pl | nl | ro | hi |
|---|---------|----|----|----|----|----|----|----|----|----|----|
| 32 | water | agua | água | eau | Wasser | acqua | вода | woda | water | apă | पानी |
| 33 | bread | pan | pão | pain | Brot | pane | хлеб | chleb | brood | pâine | रोटी |
| 34 | coffee | café | café | café | Kaffee | caffè | кофе | kawa | koffie | cafea | कॉफ़ी |
| 35 | tea | té | chá | thé | Tee | tè | чай | herbata | thee | ceai | चाय |
| 36 | apple | manzana | maçã | pomme | Apfel | mela | яблоко | jabłko | appel | măr | सेब |
| 37 | chicken | pollo | frango | poulet | Hähnchen | pollo | курица | kurczak | kip | pui | चिकन |
| 38 | rice | arroz | arroz | riz | Reis | riso | рис | ryż | rijst | orez | चावल |
| 39 | wine | vino | vinho | vin | Wein | vino | вино | wino | wijn | vin | शराब |

### Category: travel

| # | English | es | pt | fr | de | it | ru | pl | nl | ro | hi |
|---|---------|----|----|----|----|----|----|----|----|----|----|
| 40 | left | izquierda | esquerda | gauche | links | sinistra | левый | lewo | links | stânga | बाएँ |
| 41 | right | derecha | direita | droite | rechts | destra | правый | prawo | rechts | dreapta | दाएँ |
| 42 | here | aquí | aqui | ici | hier | qui | здесь | tutaj | hier | aici | यहाँ |
| 43 | there | allí | lá | là | dort | là | там | tam | daar | acolo | वहाँ |
| 44 | hotel | hotel | hotel | hôtel | Hotel | hotel | гостиница | hotel | hotel | hotel | होटल |
| 45 | train station | estación de tren | estação de trem | gare | Bahnhof | stazione ferroviaria | железнодорожная станция | dworzec kolejowy | treinstation | gară | रेलवे स्टेशन |

### Category: people

| # | English | es | pt | fr | de | it | ru | pl | nl | ro | hi |
|---|---------|----|----|----|----|----|----|----|----|----|----|
| 46 | mother | madre | mãe | mère | Mutter | madre | мать | matka | moeder | mamă | माँ |
| 47 | father | padre | pai | père | Vater | padre | отец | ojciec | vader | tată | पिता |
| 48 | friend | amigo | amigo | ami | Freund | amico | друг | przyjaciel | vriend | prieten | दोस्त |
| 49 | man | hombre | homem | homme | Mann | uomo | мужчина | mężczyzna | man | bărbat | आदमी |
| 50 | woman | mujer | mulher | femme | Frau | donna | женщина | kobieta | vrouw | femeie | औरत |

---

## 6. Entity Relationships

```
DBPhrasebook (fromTemplate: true)
    │  id: uuid
    └──► DBEntry × 50
              │  phrasebookId: DBPhrasebook.id
              │  sourceText: TEMPLATE_ENTRIES[i].sourceText
              │  targetText: TEMPLATE_ENTRIES[i].translations[targetCode]
              │  tags: TEMPLATE_ENTRIES[i].tags
              │  partOfSpeech: TEMPLATE_ENTRIES[i].partOfSpeech
              │  learningScore: 0
              └──► DBEnrichment × 50
                        entryId: DBEntry.id
                        exampleSentences: TEMPLATE_ENTRIES[i].enrichment.exampleSentences
                        synonyms: TEMPLATE_ENTRIES[i].enrichment.synonyms
                        collocations: TEMPLATE_ENTRIES[i].enrichment.collocations
```

All 151 documents (1 phrasebook + 50 entries + 50 enrichments) are written to IndexedDB in a single Dexie transaction. The phrasebook `entryCount` is set to 50 at creation (no incremental updates needed).

---

## 7. Uniqueness Constraint

**Rule**: For a given `userId`, no two phrasebooks may share the same `(sourceLanguageCode, targetLanguageCode)` pair.

**Enforcement points**:

| Layer | Mechanism | Timing |
|-------|-----------|--------|
| Frontend service | `getPhrasebooks(userId)` → filter before write | Before Dexie `.add()` call in `createPhrasebook()` and `generateTemplatePhrasebook()` |
| API | `queryByPartition(userId, { type: 'phrasebook' })` → filter before upsert | Inside `createPhrasebook` handler; returns HTTP 409 on conflict |
| UI | Disable already-used language options in `TemplatePhrasebookWizard` | Before user confirms selection |

---

## 8. State Transitions

```
[No phrasebooks]
      │
      ▼ user clicks "Start from a template"
[Language selection]
      │ user selects target language (enabled options only)
      ▼ user confirms
[Generating…]  ← single Dexie transaction: write phrasebook + 50 entries + 50 enrichments
      │          + enqueue 101 sync mutations (1 phrasebook + 50 entries + 50 enrichments)
      ▼
[Phrasebook available] ← useLiveQuery picks up the new phrasebook reactively
```
