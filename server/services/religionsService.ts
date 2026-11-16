import { Type } from '@google/genai';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import type {
  ReligionChapterRef,
  ReligionTraditionId,
  ScripturePassage,
  ScriptureWordAnalysis,
} from '../../src/types.ts';

export interface ReligionTraditionMeta {
  id: ReligionTraditionId;
  nameUrdu: string;
  bookTitleUrdu: string;
  originalLanguage: string;
  overviewUrdu: string;
  sampleTopicsUrdu: string[];
  chapters: ReligionChapterRef[];
}

export const RELIGION_TRADITIONS: ReligionTraditionMeta[] = [
  {
    id: 'torah',
    nameUrdu: 'یہودیت (توریت / عہدِ عتیق)',
    bookTitleUrdu: 'توریت مقدس (اسفارِ خمسہ)',
    originalLanguage: 'عبرانی (Hebrew)',
    overviewUrdu: 'حضرت موسیٰ علیہ السلام اور بنی اسرائیل کی قدیم کتاب، توحید اور احکامِ الٰہی کا عبرانی متن اور اردو تشریح۔',
    sampleTopicsUrdu: ['توحید اور دس احکام (Ten Commandments)', 'تخلیقِ کائنات', 'حضرت ابراہیم و موسیٰ علیہما السلام'],
    chapters: [
      { id: 'torah-ch-1', chapterNumber: 1, titleUrdu: 'کتابِ استثنا ۶ (اعلانِ توحید: شماع)', reference: 'Deuteronomy 6:4-9', summaryUrdu: 'اللہ کے ایک ہونے کا بنیادی اقرار اور دل سے محبت۔' },
      { id: 'torah-ch-2', chapterNumber: 2, titleUrdu: 'کتابِ پیدائش ۱ (کائنات کی تخلیق)', reference: 'Genesis 1:1-5', summaryUrdu: 'آسمان، زمین اور روشنی کے پیدا کیے جانے کا بیان۔' },
      { id: 'torah-ch-3', chapterNumber: 3, titleUrdu: 'کتابِ خروج ۲۰ (دس احکامِ الٰہی)', reference: 'Exodus 20:1-17', summaryUrdu: 'شرک سے ممانعت، والدین کا ادب، سچائی اور عدل کے احکام۔' },
      { id: 'torah-ch-4', chapterNumber: 4, titleUrdu: 'کتابِ پیدائش ۱۲ (حضرت ابراہیمؑ کی ہجرت و عہد)', reference: 'Genesis 12:1-3', summaryUrdu: 'حضرت ابراہیم علیہ السلام کو توحید اور برکت کا پیغام۔' },
      { id: 'torah-ch-5', chapterNumber: 5, titleUrdu: 'کتابِ احبار ۱۹ (ہمسائے اور انصاف کے حقوق)', reference: 'Leviticus 19:15-18', summaryUrdu: 'عدل، یتیم و مسکین کا حق اور دل میں بغض نہ رکھنا۔' },
    ],
  },
  {
    id: 'zabur',
    nameUrdu: 'زبورِ داؤدی (مزامیر)',
    bookTitleUrdu: 'کتابِ زبور (مزامیر)',
    originalLanguage: 'عبرانی (Hebrew)',
    overviewUrdu: 'حضرت داؤد علیہ السلام سے منسوب حمد و ثنا، مناجات اور دعاؤں کا اردو ترجمہ و قرآنی موازنہ۔',
    sampleTopicsUrdu: ['مزمور ۲۳ (اللہ کی حفاظت)', 'مزمور ۱ (نیک لوگوں کا راستہ)', 'تسبیح و حمد کے کلمات'],
    chapters: [
      { id: 'zabur-ch-1', chapterNumber: 1, titleUrdu: 'مزمور ۲۳ (رب میرا نگہبان ہے)', reference: 'Psalm 23:1-6', summaryUrdu: 'اللہ پر توکل، سکون اور حفاظت کی خوبصورت مناجات۔' },
      { id: 'zabur-ch-2', chapterNumber: 2, titleUrdu: 'مزمور ۱ (نیک اور برے لوگوں کا انجام)', reference: 'Psalm 1:1-6', summaryUrdu: 'کامیاب انسان کی نشانیاں اور کلامِ الٰہی سے محبت۔' },
      { id: 'zabur-ch-3', chapterNumber: 3, titleUrdu: 'مزمور ۵۱ (توبہ اور قلبِ سلیم کی دعا)', reference: 'Psalm 51:1-12', summaryUrdu: 'گناہوں سے معافی، دل کی صفائی اور روحانی تازگی کی دعا۔' },
      { id: 'zabur-ch-4', chapterNumber: 4, titleUrdu: 'مزمور ۹۱ (اللہ کی پناہ و امان)', reference: 'Psalm 91:1-7', summaryUrdu: 'مصیبت اور خوف کے وقت اللہ کی پناہ میں آنا۔' },
      { id: 'zabur-ch-5', chapterNumber: 5, titleUrdu: 'مزمور ۱۰۳ (اللہ کی رحمت اور شکر)', reference: 'Psalm 103:1-13', summaryUrdu: 'پروردگار کی مہربانی، مغفرت اور باپ جیسی شفقت کا ذکر۔' },
    ],
  },
  {
    id: 'injil',
    nameUrdu: 'عیسائیت (انجیل / عہدِ جدید)',
    bookTitleUrdu: 'انجیل مقدس',
    originalLanguage: 'یونانی / آرامی (Greek / Aramaic)',
    overviewUrdu: 'حضرت عیسیٰ علیہ السلام کی تعلیمات، اخلاقی نصیحتیں، لفظ بہ لفظ معنی اور قرآن مجید کے تناظر میں تجزیہ۔',
    sampleTopicsUrdu: ['پہاڑی وعظ (Sermon on the Mount)', 'توحید اور پہلا حکم', 'اخلاقیات اور معافی'],
    chapters: [
      { id: 'injil-ch-1', chapterNumber: 1, titleUrdu: 'انجیل مرقس ۱۲ (سب سے بڑا حکم: توحید)', reference: 'Mark 12:28-31', summaryUrdu: 'اللہ ایک ہے اور مخلوق کے ساتھ محبت کرنا اصل دین ہے۔' },
      { id: 'injil-ch-2', chapterNumber: 2, titleUrdu: 'انجیل متی ۵ (پہاڑی وعظ — صبر، رحم و عفو)', reference: 'Matthew 5:1-16', summaryUrdu: 'عاجزوں، امن پسندوں اور پاک دل لوگوں کے لیے بشارتیں۔' },
      { id: 'injil-ch-3', chapterNumber: 3, titleUrdu: 'انجیل متی ۶ (ریاکاری سے بچنا، نماز و صدقہ)', reference: 'Matthew 6:1-15', summaryUrdu: 'چھپ کر صدقہ، دعا اور روزہ — اور ربانی دعا۔' },
      { id: 'injil-ch-4', chapterNumber: 4, titleUrdu: 'انجیل یوحنا ۱۷ (ابدی زندگی اور یکتا سچے خدا کی معرفت)', reference: 'John 17:1-4', summaryUrdu: 'حضرت عیسیٰؑ کی مناجات: تو ہی اکیلا سچا خدا ہے۔' },
      { id: 'injil-ch-5', chapterNumber: 5, titleUrdu: 'انجیل لوقا ۱۰ (اچھے ہمسائے کی مثال)', reference: 'Luke 10:25-37', summaryUrdu: 'انسانیت کی خدمت، ہمدردی اور رنگ و نسل سے بالاتر بھلائی۔' },
    ],
  },
  {
    id: 'gita',
    nameUrdu: 'ہندومت (بھگود گیتا / اپنشد)',
    bookTitleUrdu: 'بھگود گیتا و ویدک کتب',
    originalLanguage: 'سنسکرت (Sanskrit)',
    overviewUrdu: 'ہندو مت کی معروف فلسفیانہ کتابوں کے ابواب، سنسکرت الفاظ کے معانی اور توحید و عمل کے اسلامی نقطۂ نظر سے تقابلی مطالعہ۔',
    sampleTopicsUrdu: ['باب ۲ (روح کی حقیقت اور بے غرض عمل)', 'توحید و ایشور کا تصور (اپنشد)', 'سچائی اور فرض (دھرم)'],
    chapters: [
      { id: 'gita-ch-1', chapterNumber: 1, titleUrdu: 'ادھیائے ۲ (کرم یوگ: بے غرض عمل اور روح)', reference: 'Bhagavad Gita 2:47-50', summaryUrdu: 'نتیجے کے لالچ کے بغیر سچا فرض ادا کرنا۔' },
      { id: 'gita-ch-2', chapterNumber: 2, titleUrdu: 'ادھیائے ۳ (انسان کا عملی کردار اور خدمت)', reference: 'Bhagavad Gita 3:19-21', summaryUrdu: 'بے لوث عمل سے معاشرے کے لیے مثال بننا۔' },
      { id: 'gita-ch-3', chapterNumber: 3, titleUrdu: 'ادھیائے ۱۲ (اخلاص، محبت اور صبر کی علامات)', reference: 'Bhagavad Gita 12:13-16', summaryUrdu: 'کسی سے بغض نہ رکھنا، ہر مخلوق پر مہربانی اور قناعت۔' },
      { id: 'gita-ch-4', chapterNumber: 4, titleUrdu: 'چاندوگیہ اپنشد ۶ (ایکم ایوا دویتیم — واحد خالق)', reference: 'Chandogya Upanishad 6.2.1', summaryUrdu: 'حقیقتِ مطلق ایک ہے، اس کا کوئی ثانی نہیں۔' },
      { id: 'gita-ch-5', chapterNumber: 5, titleUrdu: 'ادھیائے ۱۶ (اچھے اور برے اخلاق کا فرق)', reference: 'Bhagavad Gita 16:1-3', summaryUrdu: 'سچائی، عاجزی، بے خوفی، سخاوت اور غصے پر قابو۔' },
    ],
  },
  {
    id: 'dhammapada',
    nameUrdu: 'بدھ مت (دھم پد)',
    bookTitleUrdu: 'دھم پد (گوتم بدھ کی تعلیمات)',
    originalLanguage: 'پالی (Pali)',
    overviewUrdu: 'نفس کی پاکیزگی، اخلاق، صبر اور امن سے متعلق پالی اشعار کا اردو ترجمہ اور اسلامی تزکیۂ نفس سے تقابل۔',
    sampleTopicsUrdu: ['باب ۱ (سوچ اور دل کی پاکیزگی)', 'غصے پر قابو اور عفو', 'سچی خوشی اور قناعت'],
    chapters: [
      { id: 'dhamma-ch-1', chapterNumber: 1, titleUrdu: 'باب ۱: یمکا وگا (نیت اور دل کی پاکیزگی)', reference: 'Dhammapada 1:1-5', summaryUrdu: 'نیت کی درستگی اور نفرت کا جواب محبت سے دینا۔' },
      { id: 'dhamma-ch-2', chapterNumber: 2, titleUrdu: 'باب ۲: اپّامادا وگا (بیداری اور محنت)', reference: 'Dhammapada 2:21-24', summaryUrdu: 'غفلت سے بچنا، خود احتسابی اور سچا عمل۔' },
      { id: 'dhamma-ch-3', chapterNumber: 3, titleUrdu: 'باب ۱۷: کودھا وگا (غصے پر قابو پانا)', reference: 'Dhammapada 17:221-224', summaryUrdu: 'غصے کو نرم دلی سے، برائی کو بھلائی سے اور جھوٹ کو سچ سے جیتنا۔' },
      { id: 'dhamma-ch-4', chapterNumber: 4, titleUrdu: 'باب ۱۵: سُکھا وگا (سچی خوشی اور قناعت)', reference: 'Dhammapada 15:197-204', summaryUrdu: 'صحت، قناعت اور امانت داری ہی سب سے بڑی دولت ہے۔' },
    ],
  },
  {
    id: 'guru_granth',
    nameUrdu: 'سکھ مت (گرو گرنتھ صاحب)',
    bookTitleUrdu: 'سری گرو گرنتھ صاحب',
    originalLanguage: 'گرمکھی / پنجابی',
    overviewUrdu: 'گرو نانک دیو کی توحیدی مناجات (مول منتر) اور اخلاقی تعلیمات کا اردو ترجمہ اور اسلامی تصوف و توحید سے موازنہ۔',
    sampleTopicsUrdu: ['مول منتر (ایک اومکار — خدائے واحد)', 'جپ جی صاحب کا آغاز', 'حق حلال اور خدمتِ خلق'],
    chapters: [
      { id: 'granth-ch-1', chapterNumber: 1, titleUrdu: 'جپ جی صاحب: مول منتر (خدائے واحد کی صفات)', reference: 'Guru Granth Sahib, Ang 1', summaryUrdu: 'خالق ایک ہے، سچا نام ہے، بے خوف و بے عیب اور ابدی ہے۔' },
      { id: 'granth-ch-2', chapterNumber: 2, titleUrdu: 'جپ جی صاحب: پؤڑی ۱ تا ۳ (سچا عمل اور رضا)', reference: 'Guru Granth Sahib, Ang 1-2', summaryUrdu: 'سچائی پانے کا راستہ اللہ کی رضا (حکم) میں چلنا ہے۔' },
      { id: 'granth-ch-3', chapterNumber: 3, titleUrdu: 'سری راگ / شبد: حق حلال اور سچ بولنا', reference: 'Guru Granth Sahib, Ang 141', summaryUrdu: 'محنت کی حلال کمائی، بندگی اور مخلوق کے ساتھ انصاف۔' },
      { id: 'granth-ch-4', chapterNumber: 4, titleUrdu: 'بھگت کبیر و بابا فریدؒ کے اشعار (فنا و ذکرِ الٰہی)', reference: 'Guru Granth Sahib, Ang 1377', summaryUrdu: 'عاجزی، شکر، میٹھے بول اور آخرت کی تیاری۔' },
    ],
  },
];

const CURATED_PASSAGES: ScripturePassage[] = [
  {
    id: 'torah-shema',
    traditionId: 'torah',
    traditionNameUrdu: 'یہودیت (توریت)',
    bookNameUrdu: 'کتابِ استثنا (Deuteronomy 6:4-5)',
    reference: 'Deuteronomy 6:4-5',
    originalLanguage: 'عبرانی (Hebrew)',
    originalText: 'שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד׃',
    urduTranslation: 'اے اسرائیل سن! ہمارا رب اللہ ایک ہی معبود ہے، پس تُو اپنے رب اللہ سے اپنے پورے دل، پوری جان اور پوری طاقت سے محبت رکھ۔',
    traditionTafseerUrdu:
      'یہودی روایت میں اس آیت کو "شماع" کہا جاتا ہے جو توحیدِ خالص کا بنیادی اعلان ہے۔ قدیم مفسرین (جیسے راشی اور ابن میمون) کے مطابق "اِحاد" (אֶחָד) کا مطلب ہے کہ اللہ اپنی ذات اور صفات میں بالکل یکتا ہے اور اس کا کوئی شریک نہیں۔',
    islamicQuranicPovUrdu:
      'اسلامی و قرآنی نقطۂ نظر سے یہ مضمون سورۃ الاخلاص (قُلْ هُوَ اللَّهُ أَحَدٌ) اور سورۃ البقرہ (آیت 163) کی عین تائید ہے، کیونکہ تمام انبیاء کرام علیہم السلام (بشمول حضرت موسیٰؑ) کی اصل دعوت خالص توحید ہی تھی۔ قرآن بتاتا ہے کہ اصل توریت میں توحید کی یہی تعلیم نازل ہوئی تھی۔',
    quranicReferences: ['سورۃ الاخلاص 112:1-4', 'سورۃ البقرہ 2:163', 'سورۃ الانبیاء 21:25'],
    words: [
      { position: 1, original: 'שְׁמַע', transliteration: 'Shema', urduMeaning: 'غور سے سنو اور مانو', grammarRole: 'فعل امر' },
      { position: 2, original: 'יִשְׂרָאֵל', transliteration: 'Yisrael', urduMeaning: 'اے بنی اسرائیل (اولادِ یعقوبؑ)', grammarRole: 'اسم منادیٰ' },
      { position: 3, original: 'יְהוָה', transliteration: 'Adonai / Rabb', urduMeaning: 'ہمارا پروردگار (ہمیشہ رہنے والا)', grammarRole: 'اسم جلالہ' },
      { position: 4, original: 'אֱלֹהֵינוּ', transliteration: 'Eloheinu', urduMeaning: 'ہمارا معبودِ برحق', grammarRole: 'اسم مع ضمیر' },
      { position: 5, original: 'אֶחָד', transliteration: 'Echad', urduMeaning: 'ایک اور یکتا (اَحَد)', grammarRole: 'صفت توحید' },
    ],
  },
  {
    id: 'zabur-23',
    traditionId: 'zabur',
    traditionNameUrdu: 'زبورِ داؤدی (مزامیر)',
    bookNameUrdu: 'مزمور نمبر ۲۳ (آیت ۱-۴)',
    reference: 'Psalm 23:1-4',
    originalLanguage: 'عبرانی (Hebrew)',
    originalText: 'יְהוָה רֹעִי לֹא אֶחְסָר׃ בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי עַל־מֵי מְנֻחוֹת יְנַהֲלֵנִי׃',
    urduTranslation: 'رب میرا نگہبان (چرواہا) ہے، مجھے کسی چیز کی کمی نہ ہوگی۔ وہ مجھے ہری بھری چراگاہوں میں آرام دیتا اور سکون کے چشموں کے پاس لے چلتا ہے۔',
    traditionTafseerUrdu:
      'حضرت داؤد علیہ السلام کی یہ مناجات توکل، اللہ پر مکمل بھروسے اور قلبی اطمینان کی علامت سمجھی جاتی ہے۔ مشکل حالات اور اندھیری وادیوں میں بھی اللہ کا بندہ اس کی حفاظت کے باعث بے خوف رہتا ہے۔',
    islamicQuranicPovUrdu:
      'قرآن مجید میں اللہ تعالیٰ پر توکل اور ذکرِ الٰہی سے دل کے اطمینان کا یہی پیغام سورۃ الرعد (13:28: أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ) اور سورۃ الطلاق (65:3: وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ) میں نہایت واضح طور پر موجود ہے۔',
    quranicReferences: ['سورۃ الرعد 13:28', 'سورۃ الطلاق 65:3', 'سورۃ بنی اسرائیل 17:55'],
    words: [
      { position: 1, original: 'יְהוָה', transliteration: 'Rabb / YHWH', urduMeaning: 'پروردگارِ عالم', grammarRole: 'مبتدا' },
      { position: 2, original: 'רֹעִי', transliteration: 'Ro’i', urduMeaning: 'میرا نگہبان و محافظ', grammarRole: 'خبر' },
      { position: 3, original: 'לֹא אֶחְסָר', transliteration: 'Lo Echsar', urduMeaning: 'مجھے کوئی کمی نہ ہوگی', grammarRole: 'جملہ فعلیہ نفی' },
      { position: 4, original: 'מְנֻחוֹת', transliteration: 'Menuchot', urduMeaning: 'اطمینان اور راحت', grammarRole: 'اسم جمع' },
    ],
  },
  {
    id: 'injil-mark-12',
    traditionId: 'injil',
    traditionNameUrdu: 'عیسائیت (انجیل)',
    bookNameUrdu: 'انجیل مرقس (۱۲:۲۹)',
    reference: 'Mark 12:29-30',
    originalLanguage: 'یونانی (Greek)',
    originalText: 'Ἄκουε, Ἰσραήλ, Κύριος ὁ Θεὸς ἡμῶν Κύριος εἷς ἐστιν',
    urduTranslation: 'حضرت عیسیٰ علیہ السلام نے فرمایا: سب سے بڑا حکم یہ ہے کہ اے اسرائیل سن! ہمارا رب اور معبود ایک ہی رب ہے، اور تو اپنے پورے دل سے اس سے محبت رکھ۔',
    traditionTafseerUrdu:
      'انجیل کے شارحین کے مطابق جب ایک عالم نے حضرت عیسیٰؑ سے سب سے اہم حکم دریافت کیا تو آپ نے توریت کی اسی بنیادی توحید کو دہرایا اور اللہ سے محبت و مخلوق کے ساتھ بھلائی کو دین کی بنیاد قرار دیا۔',
    islamicQuranicPovUrdu:
      'قرآن کریم کی سورۃ آل عمران (3:51) اور سورۃ الزخرف (43:63-64) میں حضرت عیسیٰ علیہ السلام کا یہی پیغام محفوظ ہے: "بے شک اللہ میرا بھی رب ہے اور تمہارا بھی رب ہے، پس اسی کی عبادت کرو، یہی سیدھا راستہ ہے۔" اسلام اس نکتے پر اتفاق رکھتا ہے کہ عیسیٰؑ نے خالص توحید کی دعوت دی، البتہ تثلیث یا الوہیتِ مسیح کے بعد کے عقائد کی قرآن تردید کرتا ہے۔',
    quranicReferences: ['سورۃ آل عمران 3:51', 'سورۃ المائدہ 5:72', 'سورۃ الزخرف 43:64'],
    words: [
      { position: 1, original: 'Ἄκουε', transliteration: 'Akoue', urduMeaning: 'سنو اور غور کرو', grammarRole: 'فعل امر' },
      { position: 2, original: 'Κύριος', transliteration: 'Kyrios', urduMeaning: 'مالک و پروردگار', grammarRole: 'اسم' },
      { position: 3, original: 'Θεὸς', transliteration: 'Theos', urduMeaning: 'معبودِ برحق (اللہ)', grammarRole: 'اسم' },
      { position: 4, original: 'εἷς', transliteration: 'Heis', urduMeaning: 'واحد اور ایک', grammarRole: 'عدد / صفت' },
    ],
  },
  {
    id: 'gita-2-47',
    traditionId: 'gita',
    traditionNameUrdu: 'ہندومت (بھگود گیتا)',
    bookNameUrdu: 'بھگود گیتا (باب ۲، اشلوک ۴۷)',
    reference: 'Bhagavad Gita 2:47',
    originalLanguage: 'سنسکرت (Sanskrit)',
    originalText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन । मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि ॥',
    urduTranslation: 'تمہارا اختیار صرف نیک عمل اور کوشش کرنے پر ہے، نتائج پر نہیں؛ اس لیے لالچ کے بغیر اپنا فرض ادا کرو اور کبھی سستی یا بے عملی کی طرف مت جاؤ۔',
    traditionTafseerUrdu:
      'ہندو فلسفے میں اسے "نشکام کرم" (بے غرض عمل) کہا جاتا ہے: انسان کو چاہیے کہ نتیجے کی بے جا فکر یا لالچ میں پڑے بغیر پوری ایمانداری سے اپنا فرض نبھائے۔',
    islamicQuranicPovUrdu:
      'اسلامی نقطۂ نظر سے محنت و عمل کے بعد نتیجہ اللہ پر چھوڑ دینے (توکل اور اخلاصِ نیت) کی تعلیم بہت گہری ہے، جیسا کہ قرآن میں فرمایا گیا: "اور انسان کو وہی ملتا ہے جس کی وہ کوشش کرتا ہے" (53:39)۔ البتہ اسلام میں عمل کی قبولیت توحیدِ خالص اور اللہ کی رضا کی نیت سے مشروط ہے، اور تناسخ (آواگون) یا بت پرستی کے عقیدے سے اسلام واضح اختلاف رکھتا ہے۔',
    quranicReferences: ['سورۃ النجم 53:39', 'سورۃ آل عمران 3:159', 'سورۃ الانسان 76:9'],
    words: [
      { position: 1, original: 'कर्मणि', transliteration: 'Karmani', urduMeaning: 'عمل اور کوشش میں', grammarRole: 'اسم (مقام/حالت)' },
      { position: 2, original: 'अधिकारः', transliteration: 'Adhikarah', urduMeaning: 'اختیار اور حق', grammarRole: 'اسم فاعل' },
      { position: 3, original: 'फलेषु', transliteration: 'Phaleshu', urduMeaning: 'نتائج و ثمرات میں', grammarRole: 'جمع' },
      { position: 4, original: 'अकर्मणि', transliteration: 'Akarmani', urduMeaning: 'بے عملی اور سستی', grammarRole: 'نفی اسم' },
    ],
  },
  {
    id: 'dhammapada-1',
    traditionId: 'dhammapada',
    traditionNameUrdu: 'بدھ مت (دھم پد)',
    bookNameUrdu: 'دھم پد (باب ۱، شعر ۱-۲)',
    reference: 'Dhammapada 1:1-2',
    originalLanguage: 'پالی (Pali)',
    originalText: 'मनोपुब्बङ्गमा धम्मा मनोसेट्ठा मनोमया । मनसा चे पसन्नेन भासति वा करोति वा ॥',
    urduTranslation: 'انسان کے تمام اعمال کی بنیاد اس کا دل و دماغ (نیت) ہے؛ اگر کوئی پاک دل و نیک نیت کے ساتھ بات کرے یا عمل کرے تو سچی خوشی اس کے پیچھے سائے کی طرح چلتی ہے۔',
    traditionTafseerUrdu:
      'بدھ مت کے شارحین بیان کرتے ہیں کہ خارجی اعمال سے پہلے باطن اور ذہن کی صفائی اصل ہے؛ حسد، غصے اور لالچ سے پاک دل ہی حقیقی سکون پاتا ہے۔',
    islamicQuranicPovUrdu:
      'اسلام میں نیت کی اہمیت اور دل کی پاکیزگی (قلبِ سلیم اور تزکیۂ نفس) بنیادی مقام رکھتی ہے: حدیثِ مبارکہ ہے "اعمال کا دارومدار نیتوں پر ہے" (صحیح بخاری)، اور قرآن میں فرمایا گیا کہ قیامت کے دن صرف قلبِ سلیم ہی نفع دے گا (26:89)۔ اسلامی نقطۂ نظر میں دل کی مکمل اصلاح اللہ کی معرفت، ذکر اور عبادت سے مکمل ہوتی ہے۔',
    quranicReferences: ['سورۃ الشعراء 26:89', 'سورۃ الشمس 91:9-10', 'صحیح بخاری: حدیث ۱'],
    words: [
      { position: 1, original: 'मनो', transliteration: 'Mano', urduMeaning: 'دل و ذہن (نیت)', grammarRole: 'اسم' },
      { position: 2, original: 'पुब्बङ्गमा', transliteration: 'Pubbangama', urduMeaning: 'آگے رہنے والا / پیش رو', grammarRole: 'صفت' },
      { position: 3, original: 'पसन्नेन', transliteration: 'Pasannena', urduMeaning: 'پاک اور مطمئن حالت سے', grammarRole: 'صفت' },
      { position: 4, original: 'करोति', transliteration: 'Karoti', urduMeaning: 'عمل کرتا ہے', grammarRole: 'فعل مضارع' },
    ],
  },
  {
    id: 'guru-granth-mool',
    traditionId: 'guru_granth',
    traditionNameUrdu: 'سکھ مت (گرو گرنتھ صاحب)',
    bookNameUrdu: 'جپ جی صاحب (مول منتر)',
    reference: 'Guru Granth Sahib, Ang 1',
    originalLanguage: 'گرمکھی (Gurmukhi)',
    originalText: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥',
    urduTranslation: 'خدائے واحد ایک ہے، اس کا نام سچا ہے، وہی سب کا خالق ہے، ہر خوف اور دشمنی سے پاک ہے، وقت سے بالاتر لازوال ذات ہے، نہ کسی سے پیدا ہوا نہ کسی کی اولاد، وہ خود سے قائم ہے۔',
    traditionTafseerUrdu:
      'سکھ روایت میں "مول منتر" پورے گرو گرنتھ صاحب کا بنیادی عقیدہ ہے جو خدا کی وحدانیت، بے نیازی، ابدیت اور انسانی مساوات کی تعلیم دیتا ہے۔',
    islamicQuranicPovUrdu:
      'ان صفات میں قرآنی توحید (سورۃ الاخلاص: لَمْ يَلِدْ وَلَمْ يُولَدْ — نہ وہ کسی سے جنا گیا نہ اس سے کوئی پیدا ہوا، اور اسماء الحسنیٰ) سے گہری فکری مشابہت پائی جاتی ہے، جو جنوبی ایشیا میں اسلامی توحید و تصوف کے تاریخی اثرات کی عکاس بھی ہے۔ اسلام البتہ رسالتِ محمدیہ ﷺ اور قرآن کی آخری وحی کو مکمل ہدایت قرار دیتا ہے۔',
    quranicReferences: ['سورۃ الاخلاص 112:1-4', 'سورۃ الحشر 59:22-24', 'سورۃ الشوریٰ 42:11'],
    words: [
      { position: 1, original: 'ੴ', transliteration: 'Ik Onkar', urduMeaning: 'ایک خالقِ مطلق', grammarRole: 'اسم توحید' },
      { position: 2, original: 'ਸਤਿ ਨਾਮੁ', transliteration: 'Sat Naam', urduMeaning: 'حقیقی و سچا نام', grammarRole: 'صفت' },
      { position: 3, original: 'ਨਿਰਭਉ', transliteration: 'Nirbhau', urduMeaning: 'بے خوف (خوف سے پاک)', grammarRole: 'صفت' },
      { position: 4, original: 'ਅਜੂਨੀ', transliteration: 'Ajooni', urduMeaning: 'پیدائش و موت سے پاک', grammarRole: 'صفت الٰہیہ' },
    ],
  },
];

const chapterCache = new Map<string, ScripturePassage[]>();

export const religionsService = {
  getOverview() {
    return {
      traditions: RELIGION_TRADITIONS,
      passages: CURATED_PASSAGES,
    };
  },

  async loadChapterPassages(params: {
    traditionId: ReligionTraditionId;
    chapterRef: string;
  }): Promise<ScripturePassage[]> {
    const cacheKey = `${params.traditionId}::${params.chapterRef.trim().toLowerCase()}`;
    const cached = chapterCache.get(cacheKey);
    if (cached && cached.length > 0) return cached;

    const meta = RELIGION_TRADITIONS.find((t) => t.id === params.traditionId) || RELIGION_TRADITIONS[0];
    // If chapter matches one of the starter curated passages closely, place it first or return curated chapter verses
    const starterMatch = CURATED_PASSAGES.find(
      (p) =>
        p.traditionId === params.traditionId &&
        (params.chapterRef.toLowerCase().includes(p.reference.split(':')[0].toLowerCase()) ||
          p.reference.toLowerCase() === params.chapterRef.toLowerCase())
    );

    const payload = await defaultAIProvider.generateStructured<{
      passages: {
        bookNameUrdu: string;
        reference: string;
        originalText: string;
        urduTranslation: string;
        traditionTafseerUrdu: string;
        islamicQuranicPovUrdu: string;
        quranicReferences: string[];
        words: {
          position: number;
          original: string;
          transliteration: string;
          urduMeaning: string;
          grammarRole: string;
        }[];
      }[];
    }>({
      systemInstruction: `You are an expert Comparative Religion & Classical Scriptures Scholar fluent in Hebrew, Greek, Sanskrit, Pali, Gurmukhi, Arabic, and Urdu (اردو).
Present the requested scripture chapter in a structured, verse-by-verse Quran-Studio style reader consisting of 3 sequential authentic verses/passages from that chapter.
For each verse/passage provide:
1. "originalText": Authentic original-script text (no fabrication; if an exact phrasing has textual uncertainty note honestly).
2. "urduTranslation": Clear, faithful, natural Urdu script (اردو) translation.
3. "words": Key words broken down sequentially with transliteration, Urdu meaning, and grammar role in Urdu.
4. "traditionTafseerUrdu": How scholars of that tradition explain this verse (in Urdu).
5. "islamicQuranicPovUrdu": Scholarly Quranic & Islamic comparison in respectful, accurate Urdu.
6. "quranicReferences": Verified Surah/Ayah references.`,
      prompt: `Tradition: ${meta.nameUrdu} (${meta.bookTitleUrdu}, Language: ${meta.originalLanguage})
Requested Chapter / Section: "${params.chapterRef}"`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          passages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                bookNameUrdu: { type: Type.STRING },
                reference: { type: Type.STRING },
                originalText: { type: Type.STRING },
                urduTranslation: { type: Type.STRING },
                traditionTafseerUrdu: { type: Type.STRING },
                islamicQuranicPovUrdu: { type: Type.STRING },
                quranicReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                words: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      position: { type: Type.INTEGER },
                      original: { type: Type.STRING },
                      transliteration: { type: Type.STRING },
                      urduMeaning: { type: Type.STRING },
                      grammarRole: { type: Type.STRING },
                    },
                    required: ['position', 'original', 'transliteration', 'urduMeaning', 'grammarRole'],
                  },
                },
              },
              required: [
                'bookNameUrdu',
                'reference',
                'originalText',
                'urduTranslation',
                'traditionTafseerUrdu',
                'islamicQuranicPovUrdu',
                'quranicReferences',
                'words',
              ],
            },
          },
        },
        required: ['passages'],
      },
    });

    const mapped: ScripturePassage[] = (payload.passages || []).map((item, idx) => ({
      id: `ch-${meta.id}-${Date.now()}-${idx}`,
      traditionId: meta.id,
      traditionNameUrdu: meta.nameUrdu,
      bookNameUrdu: item.bookNameUrdu || meta.bookTitleUrdu,
      reference: item.reference || `${params.chapterRef} #${idx + 1}`,
      originalLanguage: meta.originalLanguage,
      originalText: item.originalText,
      urduTranslation: item.urduTranslation,
      traditionTafseerUrdu: item.traditionTafseerUrdu,
      islamicQuranicPovUrdu: item.islamicQuranicPovUrdu,
      quranicReferences: item.quranicReferences || [],
      words: item.words || [],
    }));

    const result = mapped.length > 0 ? mapped : starterMatch ? [starterMatch] : [];
    if (result.length > 0) chapterCache.set(cacheKey, result);
    return result;
  },

  async loadPassageByTopic(params: {
    traditionId: ReligionTraditionId;
    topicOrReference: string;
  }): Promise<ScripturePassage> {
    const meta = RELIGION_TRADITIONS.find((t) => t.id === params.traditionId) || RELIGION_TRADITIONS[0];

    const payload = await defaultAIProvider.generateStructured<{
      bookNameUrdu: string;
      reference: string;
      originalText: string;
      urduTranslation: string;
      traditionTafseerUrdu: string;
      islamicQuranicPovUrdu: string;
      quranicReferences: string[];
      words: {
        position: number;
        original: string;
        transliteration: string;
        urduMeaning: string;
        grammarRole: string;
      }[];
    }>({
      systemInstruction: `You are an expert Comparative Religion & Classical Scriptures Scholar fluent in Hebrew, Greek, Sanskrit, Pali, Arabic, and Urdu (اردو).
Given a religious tradition and a topic/reference, provide an authentic, verified passage from that tradition's scripture with:
1. "originalText": Accurate original-language excerpt (or classical text if original script is verified). Never invent fake verses; if exact wording is uncertain, note honestly in Urdu.
2. "urduTranslation": Clear, faithful, natural Urdu script (اردو) translation.
3. "words": Break down key words/terms of originalText with transliteration, Urdu meaning, and grammar role in Urdu.
4. "traditionTafseerUrdu": Deep commentary explaining how scholars of that religion understand this passage (in Urdu).
5. "islamicQuranicPovUrdu": Respectful, objective, scholarly comparison from the Quran & Islamic perspective in Urdu — highlighting true overlaps (like monotheism/morality) and clear theological distinctions without harshness or fabricated citations.
6. "quranicReferences": Verified Surah names and ayah numbers related to this theme.`,
      prompt: `Tradition: ${meta.nameUrdu} (${meta.bookTitleUrdu}, Language: ${meta.originalLanguage})
Requested Topic or Verse Reference: "${params.topicOrReference}"`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bookNameUrdu: { type: Type.STRING },
          reference: { type: Type.STRING },
          originalText: { type: Type.STRING },
          urduTranslation: { type: Type.STRING },
          traditionTafseerUrdu: { type: Type.STRING },
          islamicQuranicPovUrdu: { type: Type.STRING },
          quranicReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                position: { type: Type.INTEGER },
                original: { type: Type.STRING },
                transliteration: { type: Type.STRING },
                urduMeaning: { type: Type.STRING },
                grammarRole: { type: Type.STRING },
              },
              required: ['position', 'original', 'transliteration', 'urduMeaning', 'grammarRole'],
            },
          },
        },
        required: [
          'bookNameUrdu',
          'reference',
          'originalText',
          'urduTranslation',
          'traditionTafseerUrdu',
          'islamicQuranicPovUrdu',
          'quranicReferences',
          'words',
        ],
      },
    });

    return {
      id: `custom-${meta.id}-${Date.now()}`,
      traditionId: meta.id,
      traditionNameUrdu: meta.nameUrdu,
      bookNameUrdu: payload.bookNameUrdu || meta.bookTitleUrdu,
      reference: payload.reference || params.topicOrReference,
      originalLanguage: meta.originalLanguage,
      originalText: payload.originalText,
      urduTranslation: payload.urduTranslation,
      traditionTafseerUrdu: payload.traditionTafseerUrdu,
      islamicQuranicPovUrdu: payload.islamicQuranicPovUrdu,
      quranicReferences: payload.quranicReferences || [],
      words: payload.words || [],
    };
  },

  async explainWord(params: {
    traditionNameUrdu: string;
    originalLanguage: string;
    passageText: string;
    word: string;
  }): Promise<ScriptureWordAnalysis> {
    return defaultAIProvider.generateStructured<ScriptureWordAnalysis>({
      systemInstruction: `You are a Comparative Philologist & Islamic Scholar fluent in Hebrew, Greek, Sanskrit, Pali, Gurmukhi, Arabic, English, and Urdu (اردو).
Explain the selected word from a religious scripture in FULL DEPTH, showing BOTH its exact meaning in its own original language AND deep Urdu explanation:
- originalWord: exact word token
- transliteration: exact Latin phonetic pronunciation
- pronunciationUrdu: how to pronounce this word clearly in Urdu script (مثلاً: شَماع / اِحاد / كَرْمَنی)
- urduMeaning: clear, bold, accurate Urdu meaning
- meaningInOriginalLanguageUrdu: detailed explanation in Urdu of what this word means in its original language (${params.originalLanguage}), its literal root, tense/case, and semantic range
- originalLanguageNote: concise scholarly lexical note written in English + original script terms so the user sees the original tradition's exact terminology
- whyThisWordUsedUrdu: why this specific word was used in this verse and what deep nuance would change if another word were used
- rootAndHistoryUrdu: etymology and classical philological background in Urdu
- usageInBookUrdu: how scholars and commentaries of this book understand this word
- quranicComparisonUrdu: equivalent Arabic/Quranic term (e.g., أحد / رب / تقوى / إخلاص) and comparative Islamic perspective in Urdu.`,
      prompt: `Tradition: ${params.traditionNameUrdu} (${params.originalLanguage})
Passage: ${params.passageText}
Selected Word: ${params.word}`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          originalWord: { type: Type.STRING },
          transliteration: { type: Type.STRING },
          pronunciationUrdu: { type: Type.STRING },
          urduMeaning: { type: Type.STRING },
          meaningInOriginalLanguageUrdu: { type: Type.STRING },
          originalLanguageNote: { type: Type.STRING },
          whyThisWordUsedUrdu: { type: Type.STRING },
          rootAndHistoryUrdu: { type: Type.STRING },
          usageInBookUrdu: { type: Type.STRING },
          quranicComparisonUrdu: { type: Type.STRING },
        },
        required: [
          'originalWord',
          'transliteration',
          'pronunciationUrdu',
          'urduMeaning',
          'meaningInOriginalLanguageUrdu',
          'originalLanguageNote',
          'whyThisWordUsedUrdu',
          'rootAndHistoryUrdu',
          'usageInBookUrdu',
          'quranicComparisonUrdu',
        ],
      },
    });
  },

  async translatePassageDeep(params: {
    traditionId: ReligionTraditionId;
    inputText: string;
  }): Promise<ScripturePassage> {
    const meta = RELIGION_TRADITIONS.find((t) => t.id === params.traditionId) || RELIGION_TRADITIONS[0];
    const payload = await defaultAIProvider.generateStructured<{
      bookNameUrdu: string;
      reference: string;
      originalText: string;
      urduTranslation: string;
      traditionTafseerUrdu: string;
      islamicQuranicPovUrdu: string;
      quranicReferences: string[];
      words: {
        position: number;
        original: string;
        transliteration: string;
        urduMeaning: string;
        grammarRole: string;
      }[];
    }>({
      systemInstruction: `You are a Comparative Scriptures Translator & Scholar fluent in Hebrew, Greek, Sanskrit, Pali, Gurmukhi, Arabic, English, and Urdu (اردو).
The user has pasted a text, verse, phrase, or Urdu/English passage related to ${meta.nameUrdu}.
1. Provide the authentic original-language text ("originalText" in ${meta.originalLanguage}, or preserve original if already provided; never fabricate if unknown, state clearly).
2. Provide a complete, natural, deeply accurate Urdu translation ("urduTranslation").
3. Tokenize EVERY word in "originalText" inside "words" with transliteration, Urdu meaning, and grammar role.
4. Provide deep commentary in that tradition ("traditionTafseerUrdu") and objective Quranic POV comparison ("islamicQuranicPovUrdu") with verified Surah/Ayah refs.`,
      prompt: `Tradition: ${meta.nameUrdu} (${meta.originalLanguage})
Input text to translate and analyze word-by-word:
"${params.inputText}"`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bookNameUrdu: { type: Type.STRING },
          reference: { type: Type.STRING },
          originalText: { type: Type.STRING },
          urduTranslation: { type: Type.STRING },
          traditionTafseerUrdu: { type: Type.STRING },
          islamicQuranicPovUrdu: { type: Type.STRING },
          quranicReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                position: { type: Type.INTEGER },
                original: { type: Type.STRING },
                transliteration: { type: Type.STRING },
                urduMeaning: { type: Type.STRING },
                grammarRole: { type: Type.STRING },
              },
              required: ['position', 'original', 'transliteration', 'urduMeaning', 'grammarRole'],
            },
          },
        },
        required: [
          'bookNameUrdu',
          'reference',
          'originalText',
          'urduTranslation',
          'traditionTafseerUrdu',
          'islamicQuranicPovUrdu',
          'quranicReferences',
          'words',
        ],
      },
    });

    return {
      id: `tr-${meta.id}-${Date.now()}`,
      traditionId: meta.id,
      traditionNameUrdu: meta.nameUrdu,
      bookNameUrdu: payload.bookNameUrdu || `${meta.bookTitleUrdu} (ترجمہ)`,
      reference: payload.reference || 'مترجم اقتباس',
      originalLanguage: meta.originalLanguage,
      originalText: payload.originalText || params.inputText,
      urduTranslation: payload.urduTranslation,
      traditionTafseerUrdu: payload.traditionTafseerUrdu,
      islamicQuranicPovUrdu: payload.islamicQuranicPovUrdu,
      quranicReferences: payload.quranicReferences || [],
      words: payload.words || [],
    };
  },

  async askQuestion(params: {
    traditionNameUrdu: string;
    reference: string;
    passageText: string;
    question: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<string> {
    const historyBlock = (params.history || [])
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'سائل' : 'استاد'}: ${m.content}`)
      .join('\n');

    return defaultAIProvider.generateText({
      systemInstruction: `You are Bahr-ul-Ilm AI's Comparative Religion & Quranic Perspective Teacher.
Answer ONLY in clear, respectful, deeply informative **Urdu script (اردو)**.
Explain both:
1. What the cited religious scripture / tradition states (accurately, without distortion).
2. How the Quran and authentic Islamic teachings view this topic (with real Surah/Ayah references).
Never fabricate quotes or references.`,
      prompt: `Tradition: ${params.traditionNameUrdu} (${params.reference})
Passage: ${params.passageText}
${historyBlock ? `\nگفتگو کا تسلسل:\n${historyBlock}\n` : ''}
سوال: "${params.question}"`,
    });
  },
};
