import type { PartOfSpeech } from '../types/models';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateEntry {
  sourceText: string;
  partOfSpeech: PartOfSpeech;
  tags: string[];
  translations: Record<TemplateLanguageCode, string>;
}

// ─── Supported template languages ─────────────────────────────────────────────

export const TEMPLATE_LANGUAGE_CODES = ['es', 'pt', 'fr', 'de', 'it', 'ru', 'pl', 'nl', 'ro', 'hi', 'ar', 'zh', 'ja', 'ko', 'sv', 'no', 'da'] as const;
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
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'sv', name: 'Swedish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' },
];

// ─── 50 hardcoded vocabulary entries ──────────────────────────────────────────

export const TEMPLATE_ENTRIES: TemplateEntry[] = [
  // ── Greetings & Social (8) ──────────────────────────────────────────────────
  {
    sourceText: 'hello',
    partOfSpeech: 'interjection',
    tags: ['greetings', 'social'],
    translations: { es: 'hola', pt: 'olá', fr: 'bonjour', de: 'hallo', it: 'ciao', ru: 'привет', pl: 'cześć', nl: 'hallo', ro: 'bună', hi: 'नमस्ते', ar: 'مرحبا', zh: '你好', ja: 'こんにちは', ko: '안녕하세요', sv: 'hej', no: 'hei', da: 'hej' },
  },
  {
    sourceText: 'goodbye',
    partOfSpeech: 'interjection',
    tags: ['greetings', 'social'],
    translations: { es: 'adiós', pt: 'adeus', fr: 'au revoir', de: 'auf Wiedersehen', it: 'arrivederci', ru: 'до свидания', pl: 'do widzenia', nl: 'dag', ro: 'la revedere', hi: 'अलविदा', ar: 'وداعاً', zh: '再见', ja: 'さようなら', ko: '안녕히 가세요', sv: 'hejdå', no: 'ha det', da: 'hej hej' },
  },
  {
    sourceText: 'please',
    partOfSpeech: 'adverb',
    tags: ['greetings', 'social'],
    translations: { es: 'por favor', pt: 'por favor', fr: "s'il vous plaît", de: 'bitte', it: 'per favore', ru: 'пожалуйста', pl: 'proszę', nl: 'alsjeblieft', ro: 'vă rog', hi: 'कृपया', ar: 'من فضلك', zh: '请', ja: 'お願いします', ko: '부탁합니다', sv: 'snälla', no: 'vær så snill', da: 'vær så venlig' },
  },
  {
    sourceText: 'thank you',
    partOfSpeech: 'expression',
    tags: ['greetings', 'social'],
    translations: { es: 'gracias', pt: 'obrigado', fr: 'merci', de: 'danke', it: 'grazie', ru: 'спасибо', pl: 'dziękuję', nl: 'dank je', ro: 'mulțumesc', hi: 'धन्यवाद', ar: 'شكراً', zh: '谢谢', ja: 'ありがとう', ko: '감사합니다', sv: 'tack', no: 'takk', da: 'tak' },
  },
  {
    sourceText: 'sorry',
    partOfSpeech: 'interjection',
    tags: ['greetings', 'social'],
    translations: { es: 'lo siento', pt: 'desculpe', fr: 'désolé', de: 'Entschuldigung', it: 'scusa', ru: 'прости', pl: 'przepraszam', nl: 'sorry', ro: 'îmi pare rău', hi: 'माफ़ करें', ar: 'آسف', zh: '对不起', ja: 'ごめんなさい', ko: '죄송합니다', sv: 'förlåt', no: 'beklager', da: 'undskyld' },
  },
  {
    sourceText: 'yes',
    partOfSpeech: 'adverb',
    tags: ['greetings', 'social'],
    translations: { es: 'sí', pt: 'sim', fr: 'oui', de: 'ja', it: 'sì', ru: 'да', pl: 'tak', nl: 'ja', ro: 'da', hi: 'हाँ', ar: 'نعم', zh: '是', ja: 'はい', ko: '네', sv: 'ja', no: 'ja', da: 'ja' },
  },
  {
    sourceText: 'no',
    partOfSpeech: 'adverb',
    tags: ['greetings', 'social'],
    translations: { es: 'no', pt: 'não', fr: 'non', de: 'nein', it: 'no', ru: 'нет', pl: 'nie', nl: 'nee', ro: 'nu', hi: 'नहीं', ar: 'لا', zh: '不', ja: 'いいえ', ko: '아니요', sv: 'nej', no: 'nei', da: 'nej' },
  },
  {
    sourceText: 'excuse me',
    partOfSpeech: 'expression',
    tags: ['greetings', 'social'],
    translations: { es: 'perdón', pt: 'com licença', fr: 'excusez-moi', de: 'Entschuldigung', it: 'scusi', ru: 'извините', pl: 'przepraszam', nl: 'excuseer mij', ro: 'scuzați-mă', hi: 'क्षमा करें', ar: 'عذراً', zh: '打扰一下', ja: 'すみません', ko: '실례합니다', sv: 'ursäkta', no: 'unnskyld', da: 'undskyld mig' },
  },

  // ── Numbers (10) ────────────────────────────────────────────────────────────
  {
    sourceText: 'one',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'uno', pt: 'um', fr: 'un', de: 'eins', it: 'uno', ru: 'один', pl: 'jeden', nl: 'één', ro: 'unu', hi: 'एक', ar: 'واحد', zh: '一', ja: 'いち', ko: '일', sv: 'ett', no: 'en', da: 'et' },
  },
  {
    sourceText: 'two',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'dos', pt: 'dois', fr: 'deux', de: 'zwei', it: 'due', ru: 'два', pl: 'dwa', nl: 'twee', ro: 'doi', hi: 'दो', ar: 'اثنان', zh: '二', ja: 'に', ko: '이', sv: 'två', no: 'to', da: 'to' },
  },
  {
    sourceText: 'three',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'tres', pt: 'três', fr: 'trois', de: 'drei', it: 'tre', ru: 'три', pl: 'trzy', nl: 'drie', ro: 'trei', hi: 'तीन', ar: 'ثلاثة', zh: '三', ja: 'さん', ko: '삼', sv: 'tre', no: 'tre', da: 'tre' },
  },
  {
    sourceText: 'four',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'cuatro', pt: 'quatro', fr: 'quatre', de: 'vier', it: 'quattro', ru: 'четыре', pl: 'cztery', nl: 'vier', ro: 'patru', hi: 'चार', ar: 'أربعة', zh: '四', ja: 'し', ko: '사', sv: 'fyra', no: 'fire', da: 'fire' },
  },
  {
    sourceText: 'five',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'cinco', pt: 'cinco', fr: 'cinq', de: 'fünf', it: 'cinque', ru: 'пять', pl: 'pięć', nl: 'vijf', ro: 'cinci', hi: 'पाँच', ar: 'خمسة', zh: '五', ja: 'ご', ko: '오', sv: 'fem', no: 'fem', da: 'fem' },
  },
  {
    sourceText: 'six',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'seis', pt: 'seis', fr: 'six', de: 'sechs', it: 'sei', ru: 'шесть', pl: 'sześć', nl: 'zes', ro: 'şase', hi: 'छह', ar: 'ستة', zh: '六', ja: 'ろく', ko: '육', sv: 'sex', no: 'seks', da: 'seks' },
  },
  {
    sourceText: 'seven',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'siete', pt: 'sete', fr: 'sept', de: 'sieben', it: 'sette', ru: 'семь', pl: 'siedem', nl: 'zeven', ro: 'şapte', hi: 'सात', ar: 'سبعة', zh: '七', ja: 'なな', ko: '칠', sv: 'sju', no: 'sju', da: 'syv' },
  },
  {
    sourceText: 'eight',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'ocho', pt: 'oito', fr: 'huit', de: 'acht', it: 'otto', ru: 'восемь', pl: 'osiem', nl: 'acht', ro: 'opt', hi: 'आठ', ar: 'ثمانية', zh: '八', ja: 'はち', ko: '팔', sv: 'åtta', no: 'åtte', da: 'otte' },
  },
  {
    sourceText: 'nine',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'nueve', pt: 'nove', fr: 'neuf', de: 'neun', it: 'nove', ru: 'девять', pl: 'dziewięć', nl: 'negen', ro: 'nouă', hi: 'नौ', ar: 'تسعة', zh: '九', ja: 'きゅう', ko: '구', sv: 'nio', no: 'ni', da: 'ni' },
  },
  {
    sourceText: 'ten',
    partOfSpeech: 'numeral',
    tags: ['numbers'],
    translations: { es: 'diez', pt: 'dez', fr: 'dix', de: 'zehn', it: 'dieci', ru: 'десять', pl: 'dziesięć', nl: 'tien', ro: 'zece', hi: 'दस', ar: 'عشرة', zh: '十', ja: 'じゅう', ko: '십', sv: 'tio', no: 'ti', da: 'ti' },
  },

  // ── Colors (6) ──────────────────────────────────────────────────────────────
  {
    sourceText: 'red',
    partOfSpeech: 'adjective',
    tags: ['colors'],
    translations: { es: 'rojo', pt: 'vermelho', fr: 'rouge', de: 'rot', it: 'rosso', ru: 'красный', pl: 'czerwony', nl: 'rood', ro: 'roşu', hi: 'लाल', ar: 'أحمر', zh: '红色', ja: '赤', ko: '빨간색', sv: 'röd', no: 'rød', da: 'rød' },
  },
  {
    sourceText: 'blue',
    partOfSpeech: 'adjective',
    tags: ['colors'],
    translations: { es: 'azul', pt: 'azul', fr: 'bleu', de: 'blau', it: 'blu', ru: 'синий', pl: 'niebieski', nl: 'blauw', ro: 'albastru', hi: 'नीला', ar: 'أزرق', zh: '蓝色', ja: '青', ko: '파란색', sv: 'blå', no: 'blå', da: 'blå' },
  },
  {
    sourceText: 'green',
    partOfSpeech: 'adjective',
    tags: ['colors'],
    translations: { es: 'verde', pt: 'verde', fr: 'vert', de: 'grün', it: 'verde', ru: 'зелёный', pl: 'zielony', nl: 'groen', ro: 'verde', hi: 'हरा', ar: 'أخضر', zh: '绿色', ja: '緑', ko: '녹색', sv: 'grön', no: 'grønn', da: 'grøn' },
  },
  {
    sourceText: 'yellow',
    partOfSpeech: 'adjective',
    tags: ['colors'],
    translations: { es: 'amarillo', pt: 'amarelo', fr: 'jaune', de: 'gelb', it: 'giallo', ru: 'жёлтый', pl: 'żółty', nl: 'geel', ro: 'galben', hi: 'पीला', ar: 'أصفر', zh: '黄色', ja: '黄色', ko: '노란색', sv: 'gul', no: 'gul', da: 'gul' },
  },
  {
    sourceText: 'black',
    partOfSpeech: 'adjective',
    tags: ['colors'],
    translations: { es: 'negro', pt: 'preto', fr: 'noir', de: 'schwarz', it: 'nero', ru: 'чёрный', pl: 'czarny', nl: 'zwart', ro: 'negru', hi: 'काला', ar: 'أسود', zh: '黑色', ja: '黒', ko: '검은색', sv: 'svart', no: 'svart', da: 'sort' },
  },
  {
    sourceText: 'white',
    partOfSpeech: 'adjective',
    tags: ['colors'],
    translations: { es: 'blanco', pt: 'branco', fr: 'blanc', de: 'weiß', it: 'bianco', ru: 'белый', pl: 'biały', nl: 'wit', ro: 'alb', hi: 'सफ़ेद', ar: 'أبيض', zh: '白色', ja: '白', ko: '하염색', sv: 'vit', no: 'hvit', da: 'hvid' },
  },

  // ── Time & Days (7) ─────────────────────────────────────────────────────────
  {
    sourceText: 'today',
    partOfSpeech: 'adverb',
    tags: ['time'],
    translations: { es: 'hoy', pt: 'hoje', fr: "aujourd'hui", de: 'heute', it: 'oggi', ru: 'сегодня', pl: 'dzisiaj', nl: 'vandaag', ro: 'astăzi', hi: 'आज', ar: 'اليوم', zh: '今天', ja: 'きょう', ko: '오늘', sv: 'idag', no: 'i dag', da: 'i dag' },
  },
  {
    sourceText: 'tomorrow',
    partOfSpeech: 'adverb',
    tags: ['time'],
    translations: { es: 'mañana', pt: 'amanhã', fr: 'demain', de: 'morgen', it: 'domani', ru: 'завтра', pl: 'jutro', nl: 'morgen', ro: 'mâine', hi: 'कल', ar: 'غداً', zh: '明天', ja: 'あした', ko: '내일', sv: 'imorgon', no: 'i morgen', da: 'i morgen' },
  },
  {
    sourceText: 'yesterday',
    partOfSpeech: 'adverb',
    tags: ['time'],
    translations: { es: 'ayer', pt: 'ontem', fr: 'hier', de: 'gestern', it: 'ieri', ru: 'вчера', pl: 'wczoraj', nl: 'gisteren', ro: 'ieri', hi: 'कल', ar: 'أمس', zh: '昨天', ja: 'きのう', ko: '어제', sv: 'igår', no: 'i går', da: 'i går' },
  },
  {
    sourceText: 'morning',
    partOfSpeech: 'noun',
    tags: ['time'],
    translations: { es: 'mañana', pt: 'manhã', fr: 'matin', de: 'Morgen', it: 'mattina', ru: 'утро', pl: 'rano', nl: 'ochtend', ro: 'dimineață', hi: 'सुबह', ar: 'صباح', zh: '早上', ja: 'あさ', ko: '아침', sv: 'morgon', no: 'morgen', da: 'morgen' },
  },
  {
    sourceText: 'evening',
    partOfSpeech: 'noun',
    tags: ['time'],
    translations: { es: 'tarde', pt: 'tarde', fr: 'soir', de: 'Abend', it: 'sera', ru: 'вечер', pl: 'wieczór', nl: 'avond', ro: 'seară', hi: 'शाम', ar: 'مساء', zh: '晚上', ja: 'ゆうがた', ko: '저녁', sv: 'kväll', no: 'kveld', da: 'aften' },
  },
  {
    sourceText: 'Monday',
    partOfSpeech: 'noun',
    tags: ['time', 'days'],
    translations: { es: 'lunes', pt: 'segunda-feira', fr: 'lundi', de: 'Montag', it: 'lunedì', ru: 'понедельник', pl: 'poniedziałek', nl: 'maandag', ro: 'luni', hi: 'सोमवार', ar: 'الاثنين', zh: '星期一', ja: '月曜日', ko: '월요일', sv: 'måndag', no: 'mandag', da: 'mandag' },
  },
  {
    sourceText: 'Sunday',
    partOfSpeech: 'noun',
    tags: ['time', 'days'],
    translations: { es: 'domingo', pt: 'domingo', fr: 'dimanche', de: 'Sonntag', it: 'domenica', ru: 'воскресенье', pl: 'niedziela', nl: 'zondag', ro: 'duminică', hi: 'रविवार', ar: 'الأحد', zh: '星期日', ja: '日曜日', ko: '일요일', sv: 'söndag', no: 'søndag', da: 'søndag' },
  },

  // ── Food & Drink (8) ────────────────────────────────────────────────────────
  {
    sourceText: 'water',
    partOfSpeech: 'noun',
    tags: ['food', 'drink'],
    translations: { es: 'agua', pt: 'água', fr: 'eau', de: 'Wasser', it: 'acqua', ru: 'вода', pl: 'woda', nl: 'water', ro: 'apă', hi: 'पानी', ar: 'ماء', zh: '水', ja: 'みず', ko: '물', sv: 'vatten', no: 'vann', da: 'vand' },
  },
  {
    sourceText: 'bread',
    partOfSpeech: 'noun',
    tags: ['food'],
    translations: { es: 'pan', pt: 'pão', fr: 'pain', de: 'Brot', it: 'pane', ru: 'хлеб', pl: 'chleb', nl: 'brood', ro: 'pâine', hi: 'रोटी', ar: 'خبز', zh: '面包', ja: 'パン', ko: '빵', sv: 'bröd', no: 'brød', da: 'brød' },
  },
  {
    sourceText: 'coffee',
    partOfSpeech: 'noun',
    tags: ['food', 'drink'],
    translations: { es: 'café', pt: 'café', fr: 'café', de: 'Kaffee', it: 'caffè', ru: 'кофе', pl: 'kawa', nl: 'koffie', ro: 'cafea', hi: 'कॉफ़ी', ar: 'قهوة', zh: '咋啊啡', ja: 'コーヒー', ko: '커피', sv: 'kaffe', no: 'kaffe', da: 'kaffe' },
  },
  {
    sourceText: 'tea',
    partOfSpeech: 'noun',
    tags: ['food', 'drink'],
    translations: { es: 'té', pt: 'chá', fr: 'thé', de: 'Tee', it: 'tè', ru: 'чай', pl: 'herbata', nl: 'thee', ro: 'ceai', hi: 'चाय', ar: 'شاي', zh: '茶', ja: 'おちゃ', ko: '다', sv: 'te', no: 'te', da: 'te' },
  },
  {
    sourceText: 'apple',
    partOfSpeech: 'noun',
    tags: ['food', 'fruit'],
    translations: { es: 'manzana', pt: 'maçã', fr: 'pomme', de: 'Apfel', it: 'mela', ru: 'яблоко', pl: 'jabłko', nl: 'appel', ro: 'măr', hi: 'सेब', ar: 'تفاحة', zh: '苹果', ja: 'りんご', ko: '사과', sv: 'äpple', no: 'eple', da: 'æble' },
  },
  {
    sourceText: 'chicken',
    partOfSpeech: 'noun',
    tags: ['food', 'meat'],
    translations: { es: 'pollo', pt: 'frango', fr: 'poulet', de: 'Hähnchen', it: 'pollo', ru: 'курица', pl: 'kurczak', nl: 'kip', ro: 'pui', hi: 'चिकन', ar: 'دجاج', zh: '鸡肉', ja: 'とりにく', ko: '닭고기', sv: 'kyckling', no: 'kylling', da: 'kylling' },
  },
  {
    sourceText: 'rice',
    partOfSpeech: 'noun',
    tags: ['food'],
    translations: { es: 'arroz', pt: 'arroz', fr: 'riz', de: 'Reis', it: 'riso', ru: 'рис', pl: 'ryż', nl: 'rijst', ro: 'orez', hi: 'चावल', ar: 'أرز', zh: '米饰', ja: 'ごはん', ko: '쌍', sv: 'ris', no: 'ris', da: 'ris' },
  },
  {
    sourceText: 'wine',
    partOfSpeech: 'noun',
    tags: ['food', 'drink'],
    translations: { es: 'vino', pt: 'vinho', fr: 'vin', de: 'Wein', it: 'vino', ru: 'вино', pl: 'wino', nl: 'wijn', ro: 'vin', hi: 'शराब', ar: 'نبيذ', zh: '葬配', ja: 'ワイン', ko: '와인', sv: 'vin', no: 'vin', da: 'vin' },
  },

  // ── Travel & Directions (6) ─────────────────────────────────────────────────
  {
    sourceText: 'left',
    partOfSpeech: 'noun',
    tags: ['travel', 'directions'],
    translations: { es: 'izquierda', pt: 'esquerda', fr: 'gauche', de: 'links', it: 'sinistra', ru: 'налево', pl: 'lewo', nl: 'links', ro: 'stânga', hi: 'बायां', ar: 'يسار', zh: '左', ja: 'ひだり', ko: '왼쪽', sv: 'vänster', no: 'venstre', da: 'venstre' },
  },
  {
    sourceText: 'right',
    partOfSpeech: 'noun',
    tags: ['travel', 'directions'],
    translations: { es: 'derecha', pt: 'direita', fr: 'droite', de: 'rechts', it: 'destra', ru: 'направо', pl: 'prawo', nl: 'rechts', ro: 'dreapta', hi: 'दायां', ar: 'يمين', zh: '右', ja: 'みぎ', ko: '오른쪽', sv: 'höger', no: 'høyre', da: 'højre' },
  },
  {
    sourceText: 'here',
    partOfSpeech: 'adverb',
    tags: ['travel', 'directions'],
    translations: { es: 'aquí', pt: 'aqui', fr: 'ici', de: 'hier', it: 'qui', ru: 'здесь', pl: 'tutaj', nl: 'hier', ro: 'aici', hi: 'यहां', ar: 'هنا', zh: '这里', ja: 'ここ', ko: '여기', sv: 'här', no: 'her', da: 'her' },
  },
  {
    sourceText: 'there',
    partOfSpeech: 'adverb',
    tags: ['travel', 'directions'],
    translations: { es: 'allí', pt: 'lá', fr: 'là', de: 'dort', it: 'lì', ru: 'там', pl: 'tam', nl: 'daar', ro: 'acolo', hi: 'वहां', ar: 'هناك', zh: '那里', ja: 'そこ', ko: '거기', sv: 'där', no: 'der', da: 'der' },
  },
  {
    sourceText: 'hotel',
    partOfSpeech: 'noun',
    tags: ['travel', 'accommodation'],
    translations: { es: 'hotel', pt: 'hotel', fr: 'hôtel', de: 'Hotel', it: 'albergo', ru: 'гостиница', pl: 'hotel', nl: 'hotel', ro: 'hotel', hi: 'होटल', ar: 'فندق', zh: '酒店', ja: 'ホテル', ko: '호텔', sv: 'hotell', no: 'hotell', da: 'hotel' },
  },
  {
    sourceText: 'train station',
    partOfSpeech: 'noun',
    tags: ['travel', 'transport'],
    translations: { es: 'estación de tren', pt: 'estação de trem', fr: 'gare', de: 'Bahnhof', it: 'stazione ferroviaria', ru: 'железнодорожная станция', pl: 'dworzec kolejowy', nl: 'treinstation', ro: 'gară', hi: 'रेलवे स्टेशन', ar: 'محطة القطار', zh: '火车站', ja: '駅', ko: '기차역', sv: 'tågstation', no: 'togstasjon', da: 'togstation' },
  },

  // ── People & Family (5) ─────────────────────────────────────────────────────
  {
    sourceText: 'mother',
    partOfSpeech: 'noun',
    tags: ['people', 'family'],
    translations: { es: 'madre', pt: 'mãe', fr: 'mère', de: 'Mutter', it: 'madre', ru: 'мама', pl: 'mama', nl: 'moeder', ro: 'mamă', hi: 'मां', ar: 'أم', zh: '妈妈', ja: 'おかあさん', ko: '어머니', sv: 'mamma', no: 'mamma', da: 'mor' },
  },
  {
    sourceText: 'father',
    partOfSpeech: 'noun',
    tags: ['people', 'family'],
    translations: { es: 'padre', pt: 'pai', fr: 'père', de: 'Vater', it: 'padre', ru: 'отец', pl: 'ojciec', nl: 'vader', ro: 'tată', hi: 'पिता', ar: 'أب', zh: '爸爸', ja: 'おとうさん', ko: '아버지', sv: 'pappa', no: 'pappa', da: 'far' },
  },
  {
    sourceText: 'friend',
    partOfSpeech: 'noun',
    tags: ['people', 'social'],
    translations: { es: 'amigo', pt: 'amigo', fr: 'ami', de: 'Freund', it: 'amico', ru: 'друг', pl: 'przyjaciel', nl: 'vriend', ro: 'prieten', hi: 'दोस्त', ar: 'صديق', zh: '朋友', ja: 'ともだち', ko: '친구', sv: 'vän', no: 'venn', da: 'ven' },
  },
  {
    sourceText: 'man',
    partOfSpeech: 'noun',
    tags: ['people'],
    translations: { es: 'hombre', pt: 'homem', fr: 'homme', de: 'Mann', it: 'uomo', ru: 'мужчина', pl: 'mężczyzna', nl: 'man', ro: 'bărbat', hi: 'आदमी', ar: 'رجل', zh: '男人', ja: 'おとこ', ko: '남자', sv: 'man', no: 'mann', da: 'mand' },
  },
  {
    sourceText: 'woman',
    partOfSpeech: 'noun',
    tags: ['people'],
    translations: { es: 'mujer', pt: 'mulher', fr: 'femme', de: 'Frau', it: 'donna', ru: 'женщина', pl: 'kobieta', nl: 'vrouw', ro: 'femeie', hi: 'औरत', ar: 'امرأة', zh: '女人', ja: 'じょせい', ko: '여자', sv: 'kvinna', no: 'kvinne', da: 'kvinde' },
  },
];
