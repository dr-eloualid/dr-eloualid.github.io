/* ═══ Assistant du cabinet — réponses FIXES, français / arabe / darija ═══
   31/10/2026 : remplace l'IA locale (Ollama sur le PC du cabinet, port 5190). Testée sur 5 questions
   courantes, elle se trompait sur 3 (« je ne connais pas les compétences du docteur », envoyait un
   saignement à l'hôpital au lieu du 06 58, ne comprenait pas la darija), et elle n'était de toute façon
   pas joignable depuis Internet.
   Ici, tout tourne dans la page : aucune donnée envoyée, aucun serveur, réponse immédiate.
   Chaque réponse reprend un texte déjà validé sur le site ; ce qui n'est pas prévu part vers le
   secrétariat (WhatsApp), jamais une réponse inventée. Jamais de tarif, jamais d'avis médical. */
(function (global) {
  'use strict';

  var WA = 'https://wa.me/212658562973';
  var TEL_MOBILE = 'tel:+212658562973', TEL_FIXE = 'tel:+212535283863';
  var MAPS = 'https://www.google.com/maps/search/?api=1&query=Cabinet%20Urologie%20Dr%20El%20Oualid%20Taza&query_place_id=ChIJkWoVLoMXng0RQgrMnZ6-3EY';

  // ── normalisation : minuscules, sans accents, arabe sans voyelles ni variantes de lettres ──
  function norm(s) {
    s = String(s || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    // NFD sépare la hamza (أ = ا + U+0654) : on retire voyelles, hamza/madda détachées et tatweel.
    s = s.replace(/[ً-ٰٕـ]/g, '')
         .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
    s = s.replace(/[^a-z0-9ء-ي\s]/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  var AR = /[؀-ۿ]/;

  // Un mot-clé latin correspond au DÉBUT d'un mot (« horaire » trouve « horaires ») ;
  // terminé par « $ », il doit être le mot entier (« dem » ne doit pas trouver « demain »).
  // Un mot-clé arabe correspond au début d'un mot, après و ف ب ل ك et/ou ال.
  function contient(texte, mots, kw) {
    var entier = kw.charAt(kw.length - 1) === '$';
    var k = norm(entier ? kw.slice(0, -1) : kw);
    if (!k) return false;
    if (!AR.test(k)) {
      var t = ' ' + texte + ' ';
      return entier ? t.indexOf(' ' + k + ' ') >= 0 : t.indexOf(' ' + k) >= 0;
    }
    if (k.indexOf(' ') >= 0) return (' ' + texte).indexOf(' ' + k) >= 0;
    for (var i = 0; i < mots.length; i++) {
      var m = mots[i], essais = [m];
      if (/^[وفبلك]/.test(m)) essais.push(m.slice(1));
      for (var j = essais.length - 1; j >= 0; j--) if (essais[j].indexOf('ال') === 0) essais.push(essais[j].slice(2));
      for (var e = 0; e < essais.length; e++) if (entier ? essais[e] === k : essais[e].indexOf(k) === 0) return true;
    }
    return false;
  }

  function ouvertMaintenant(lang) {
    var d = new Date(), j = d.getDay(), h = d.getHours() + d.getMinutes() / 60;
    var ouvert = (j >= 1 && j <= 5 && h >= 9 && h < 19) || (j === 6 && h >= 9 && h < 13);
    if (lang === 'ar') return ouvert ? 'الآن: العيادة مفتوحة (تغلق على ' + (j === 6 ? '13:00' : '19:00') + ').' : 'الآن: العيادة مغلقة.';
    return ouvert ? 'En ce moment : ouvert (ferme à ' + (j === 6 ? '13h' : '19h') + ').' : 'En ce moment : fermé.';
  }

  function waLien(msg) { return WA + '?text=' + encodeURIComponent(msg); }
  var A = {
    appelerMobile: { fr: '📞 Appeler le 06 58 56 29 73', ar: '📞 اتصلوا بالرقم 06 58 56 29 73', href: TEL_MOBILE },
    appelerFixe:   { fr: '☎ Appeler le 05 35 28 38 63', ar: '☎ الهاتف الثابت 05 35 28 38 63', href: TEL_FIXE },
    whatsappRdv:   { fr: '💬 Rendez-vous sur WhatsApp', ar: '💬 موعد عبر واتساب',
                     hrefFr: waLien('Bonjour Docteur, je souhaite prendre un rendez-vous.'),
                     hrefAr: waLien('السلام عليكم دكتور، أريد أخذ موعد.') },
    whatsapp:      { fr: '💬 Écrire au cabinet sur WhatsApp', ar: '💬 راسلوا العيادة عبر واتساب', href: WA },
    maps:          { fr: '📍 Itinéraire Google Maps', ar: '📍 الطريق على خرائط Google', href: MAPS, ext: true }
  };

  // ── les sujets, dans l'ordre de priorité en cas d'égalité ──
  var SUJETS = [
    { id: 'urgence',
      kw: ['urgent', 'urgence', 'sang', 'saign', 'hematur', 'fievre', 'bloque', 'retention', 'n arrive pas a uriner', 'arrive plus a uriner',
           'peux pas uriner', 'peux plus uriner', 'colique', 'douleur violente', 'douleur insupportable', 'tres mal', 'dem$', 'ddem$', 'skhana', 's5ana',
           'ma kanbolch', 'makanbolch', 'manbolch', 'mstaajel', 'mosta3jal',
           'مستعجل', 'عاجل', 'دم$', 'الدم$', 'دمم', 'نزيف', 'سخانه', 'حمي', 'ما كنبولش', 'ماكنبولش', 'مقدرتش نبول', 'محبوس', 'وجع قوي', 'وجع كبير'],
      fr: function () { return '⚠ Si c\'est urgent, appelez maintenant le 06 58 56 29 73 : le cabinet répond 24h/24.\nDu sang dans les urines, même une seule fois, doit toujours être vérifié sans attendre.\nEn cas d\'urgence vitale, rendez-vous aux urgences les plus proches.'; },
      ar: function () { return '⚠ إذا كانت الحالة مستعجلة، اتصلوا الآن بالرقم 06 58 56 29 73: العيادة تجيب على مدار الساعة.\nالدم في البول، ولو مرة واحدة، يجب فحصه دون تأخير.\nوفي الحالات الخطيرة توجهوا لأقرب مستعجلات.'; },
      actions: ['appelerMobile'] },

    { id: 'tarif',
      kw: ['prix', 'tarif', 'combien', 'cout', 'payer', 'paiement', 'honoraire', 'chhal', 'bchhal', 'ch7al', 'bch7al', 'taman', 'tamane', 'flous', 'flouss', 'dh$', 'dirham',
           'شحال', 'بشحال', 'الثمن', 'ثمن', 'تمن', 'فلوس', 'درهم', 'بكم', 'تكلفه', 'الاثمنه', 'اثمنه'],
      fr: function () { return 'Pour les tarifs et la prise en charge, contactez le secrétariat : 05 35 28 38 63 ou WhatsApp 06 58 56 29 73.\nLe cabinet fournit tous les documents nécessaires à votre remboursement CNSS, AMO ou mutuelle.'; },
      ar: function () { return 'للاستفسار عن الأثمنة والتعويض، تواصلوا مع الاستقبال: 05 35 28 38 63 أو واتساب 06 58 56 29 73.\nالعيادة تسلمكم كل الوثائق اللازمة لاسترجاع مصاريفكم من CNSS أو AMO أو تعاضديتكم.'; },
      actions: ['whatsapp', 'appelerFixe'] },

    { id: 'mutuelle',
      kw: ['mutuelle', 'cnss', 'amo$', 'cnops', 'assurance', 'rembours', 'prise en charge', 'ta3adodiya', 'tadamon',
           'تعاضدي', 'التامين', 'تامين', 'كنوبس', 'الضمان', 'تعويض', 'استرجاع'],
      fr: function () { return 'Le cabinet fournit tous les documents nécessaires à votre remboursement CNSS, AMO ou mutuelle.\nPour une question précise sur votre dossier, le secrétariat vous répond sur WhatsApp.'; },
      ar: function () { return 'العيادة تسلمكم كل الوثائق اللازمة لاسترجاع مصاريفكم من CNSS أو AMO أو تعاضديتكم.\nولأي سؤال خاص بملفكم، يجيبكم الاستقبال عبر واتساب.'; },
      actions: ['whatsapp'] },

    { id: 'adresse',
      kw: ['adresse', 'comment venir', 'comment aller', 'ou est', 'ou se trouve', 'ou etes', 'ou vous', 'situe', 'trouver le cabinet', 'localisation', 'itineraire', 'plan$', 'maps', 'carte$', 'acces',
           'parking', 'etage', 'quartier', 'fin$', 'fine$', 'fin kayn', 'blasa', 'blassa', '3onwan', 'l3onwan',
           'فين', 'اين', 'عنوان', 'بلاصه', 'مكان', 'موقع', 'كيفاش نوصل', 'الطريق', 'خريطه'],
      fr: function () { return 'Le cabinet se trouve boulevard Allal El Fassi, Immeuble Irak 1, appartement 6, 1er étage, Taza.'; },
      ar: function () { return 'العيادة في شارع علال الفاسي، عمارة العراق 1، الشقة 6، الطابق الأول، تازة.'; },
      actions: ['maps'] },

    { id: 'horaires',
      kw: ['horaire', 'heure', 'ouvert', 'ouvre', 'ferme', 'samedi', 'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'aujourd', 'demain', 'quand',
           'waqt', 'wa9t', 'lwe9t', 'lwa9t', 'm7lol', 'm7loul', 'mhlol', 'msdod', 'sbt$', 'nhar', 'ghda', 'ghedda',
           'وقت', 'اوقات', 'الساعه', 'ساعه', 'مفتوح', 'محلول', 'مسدود', 'مغلق', 'السبت', 'سبت', 'الاحد', 'الحد', 'الاثنين', 'الجمعه', 'غدا', 'غدوه', 'نهار', 'امتي', 'متي',
           'كاين الطبيب', 'كاين الدكتور', 'الطبيب كاين', 'الدكتور كاين'],
      fr: function () { return 'Le cabinet est ouvert du lundi au vendredi de 9h à 19h, et le samedi de 9h à 13h. Fermé le dimanche.\n' + ouvertMaintenant('fr') + '\nPour être sûr d\'être reçu à l\'heure voulue, prenez rendez-vous. Urgences : 06 58 56 29 73, 24h/24.'; },
      ar: function () { return 'العيادة مفتوحة من الاثنين إلى الجمعة من 9:00 إلى 19:00، ويوم السبت من 9:00 إلى 13:00. مغلقة يوم الأحد.\n' + ouvertMaintenant('ar') + '\nولضمان الاستقبال في الوقت المناسب، خذوا موعدًا. المستعجلات: 06 58 56 29 73 على مدار الساعة.'; },
      actions: ['whatsappRdv'] },

    { id: 'chirurgie',
      kw: ['oper', 'chirurg', 'intervention', 'laser', 'calcul', 'pierre', 'lithiase', 'prostate', 'circonci', 'tahara', 't7ara', 'khtan', 'hydrocele', 'varicocele',
           'sonde', 'jj$', 'hernie', 'rtuv', 'rtup', 'nlpc', 'uretero', 'coelio', 'clinique', 'hopital', 'hospital', '7ajra', 'hjra', 'l7jer', 'brostat',
           'عملي', 'جراح', 'الحجر', 'حجره', 'حجر', 'حصي', 'البروستات', 'بروستات', 'طهاره', 'ختان', 'ليزر', 'مصحه', 'سبيطار', 'مستشفي', 'فتق', 'قيله'],
      fr: function () { return 'Oui, le Dr El Oualid est chirurgien urologue. Il opère notamment : les calculs (laser, urétéroscopie, NLPC), la prostate, les tumeurs de la vessie (RTUV), le rein et la vessie par cœlioscopie, la circoncision (enfant et adulte), l\'hydrocèle, la varicocèle, la hernie inguinale, la sténose de l\'urètre, et il pose ou retire les sondes JJ.\nLes interventions ont lieu en clinique : Polyclinique Ibnou Baja (Taza) et Hôpital international AKDITAL (Fès).\nPour savoir si votre cas relève d\'une opération, il faut d\'abord une consultation.'; },
      ar: function () { return 'نعم، الدكتور الوليد طبيب وجراح المسالك البولية. من العمليات التي يجريها: الحصى (بالليزر وبالمنظار)، البروستاتا، أورام المثانة، جراحة الكلية والمثانة بالمنظار (الكوليوسكوبي)، الطهارة (للأطفال والكبار)، القيلة المائية، دوالي الخصية، الفتق، تضيق مجرى البول، وتركيب أو إزالة قسطرة JJ.\nتجرى العمليات في المصحة: مصحة ابن باجة (تازة) والمستشفى الدولي أكديتال (فاس).\nلمعرفة هل تحتاج حالتكم إلى عملية، يجب أولًا إجراء استشارة.'; },
      actions: ['whatsappRdv'] },

    { id: 'rdv',
      kw: ['rendez', 'rdv', 'reserv', 'prendre', 'consulter', 'consultation', 'voir le docteur', 'voir le medecin', 'venir', 'passer', 'sans rendez',
           'bghit', 'nji$', 'njiw', 'maw3id', 'mou3id', 'mw3d', 'nchof', 'nchouf',
           'موعد', 'نجي', 'نشوف الطبيب', 'نشوف الدكتور', 'بغيت', 'حجز', 'نحجز', 'استشاره', 'فحص'],
      fr: function () { return 'Pour prendre rendez-vous, écrivez-nous sur WhatsApp ou appelez le 05 35 28 38 63 / 06 58 56 29 73.\nLe rendez-vous est recommandé, mais le cabinet accueille aussi sans rendez-vous selon l\'affluence.'; },
      ar: function () { return 'لأخذ موعد، راسلونا عبر واتساب أو اتصلوا بالرقم 05 35 28 38 63 أو 06 58 56 29 73.\nالموعد مستحسن، لكن العيادة تستقبل أيضًا بدون موعد حسب الازدحام.'; },
      actions: ['whatsappRdv', 'appelerFixe'] },

    { id: 'documents',
      kw: ['document', 'apporter', 'ramener', 'papier', 'dossier', 'cin$', 'carte nationale', 'njib', 'jib$', 'lwra9', 'lwraq',
           'وثائق', 'اوراق', 'نجيب', 'نحضر', 'احضر', 'البطاقه'],
      fr: function () { return 'Apportez votre CIN, votre carte de mutuelle si vous en avez une, vos anciens comptes rendus, analyses et imageries, et la liste de vos médicaments en cours.'; },
      ar: function () { return 'أحضروا بطاقتكم الوطنية، بطاقة التعاضدية إن وجدت، التقارير والتحاليل والصور القديمة، ولائحة الأدوية الحالية.'; },
      actions: [] },

    { id: 'debitmetrie',
      kw: ['debitmetr', 'debit', 'jet$', 'flux'],
      fr: function () { return 'La débitmétrie mesure la force du jet urinaire : vous urinez simplement dans un appareil, au cabinet, le jour même de la consultation.\nVenez avec une envie d\'uriner (vessie pleine) ; le secrétariat vous le précisera à la prise de rendez-vous.'; },
      ar: function () { return 'قياس دفق البول فحص بسيط: تتبولون في جهاز خاص داخل العيادة، في يوم الاستشارة نفسه.\nاحضروا والمثانة ممتلئة (مع الرغبة في التبول)، والاستقبال يوضح لكم ذلك عند أخذ الموعد.'; },
      actions: ['whatsappRdv'] },

    { id: 'echo',
      kw: ['vessie pleine', 'pleine', 'boire', 'a jeun', 'jeun$', 'preparation', 'preparer', 'echo', 'sur place',
           'دفق', 'صبيب', 'المثانه', 'ممتلئه', 'عامره', 'نشرب', 'صايم', 'الريق', 'ايكو', 'تحضير', 'الفحص بالصدى'],
      fr: function () { return 'L\'échographie de l\'appareil urinaire et la débitmétrie se font au cabinet, le jour même de la consultation.\nPour une échographie de la vessie ou de la prostate, une vessie moyennement pleine aide : buvez environ 2 verres d\'eau une heure avant, sans uriner juste avant l\'examen. Le secrétariat vous le précisera selon le motif.'; },
      ar: function () { return 'الفحص بالإيكو للمسالك البولية وقياس دفق البول يجريان داخل العيادة، في يوم الاستشارة نفسه.\nلتصوير المثانة أو البروستاتا بالإيكو، يستحسن شرب كوبين من الماء قبل ساعة وعدم التبول مباشرة قبل الفحص. والاستقبال يوضح لكم ذلك عند أخذ الموعد.'; },
      actions: [] },

    { id: 'femmesEnfants',
      kw: ['femme', 'enfant', 'bebe', 'fille', 'garcon', 'fils$', 'dame', 'mra$', 'lmra', 'tfl', 'drari', 'wlidi', 'bnti', '3yalat',
           'امراه', 'المراه', 'نساء', 'طفل', 'اطفال', 'ولدي', 'بنتي', 'دراري', 'عيالات', 'مرا$'],
      fr: function () { return 'Oui. L\'urologie concerne l\'homme, la femme (infections, calculs, incontinence…) et l\'enfant.'; },
      ar: function () { return 'نعم. طب المسالك البولية يهم الرجل والمرأة (الالتهابات، الحصى، تسرب البول…) والطفل.'; },
      actions: ['whatsappRdv'] },

    { id: 'contact',
      kw: ['telephone', 'numero', 'appeler', 'joindre', 'contact', 'whatsapp', 'watsap', 'wtsp', 'tel$', 'raqm', 'nmra', 'nmro',
           'رقم', 'نمره', 'هاتف', 'تلفون', 'واتساب', 'نتصل', 'اتصال'],
      fr: function () { return 'Téléphone fixe : 05 35 28 38 63\nMobile et WhatsApp : 06 58 56 29 73 (urgences 24h/24)'; },
      ar: function () { return 'الهاتف الثابت: 05 35 28 38 63\nالمحمول وواتساب: 06 58 56 29 73 (المستعجلات على مدار الساعة)'; },
      actions: ['appelerFixe', 'whatsapp'] },

    { id: 'symptome',
      kw: ['douleur', 'mal$', 'brul', 'envie', 'urin', 'pipi', 'fuite', 'incontinence', 'erection', 'infertil', 'psa$', 'infection', 'la nuit',
           'kaybol', 'kanbol', 'nboul', 'tberri', 'kat7r9ni', 'kayhr9ni',
           'وجع', 'حريق', 'حرقه', 'البول', 'نبول', 'كنبول', 'تبول', 'انتصاب', 'عقم', 'تسرب', 'الليل'],
      fr: function () { return 'Je ne peux pas donner d\'avis médical par écrit. Le plus sûr est d\'en parler au docteur : prenez rendez-vous sur WhatsApp.\nSi c\'est intense, avec de la fièvre, ou s\'il y a du sang dans les urines, appelez tout de suite le 06 58 56 29 73 (24h/24).'; },
      ar: function () { return 'لا يمكنني إعطاء رأي طبي كتابةً. الأفضل أن تتحدثوا مع الدكتور: خذوا موعدًا عبر واتساب.\nإذا كان الألم قويًا، أو مع حمى، أو مع دم في البول، اتصلوا فورًا بالرقم 06 58 56 29 73 (على مدار الساعة).'; },
      actions: ['whatsappRdv', 'appelerMobile'] }
  ];

  var SALUT = ['bonjour', 'bonsoir', 'salut', 'salam', 'slm$', 'cc$', 'coucou', 'hello', 'ahlan', 'السلام', 'سلام', 'مرحبا', 'اهلا', 'صباح الخير', 'مساء الخير'];
  var MERCI = ['merci', 'choukran', 'chokran', 'shukran', 'thanks', 'شكرا', 'بارك الله', 'الله يخليك'];
  var DARIJA_LATIN = /(^| )(wach|wash|chhal|bchhal|bghit|kayn|kayen|kayna|dyal|diyal|nta|nti|3and|m3a|daba|chno|ach|wakha|safi|labas)( |$)|[a-z][2379]|[2379][a-z]/;

  function langueDe(texte, langPage) {
    if (AR.test(texte)) return 'ar';
    if (DARIJA_LATIN.test(norm(texte))) return 'ar';
    return langPage === 'ar' ? 'ar' : 'fr';
  }

  function score(texte, mots, liste) { var n = 0; for (var i = 0; i < liste.length; i++) if (contient(texte, mots, liste[i])) n++; return n; }

  // Renvoie { id, lang, texte, actions:[{label, href, ext}] } — fonction pure, testable hors navigateur.
  function repondre(question, langPage) {
    var lang = langueDe(question, langPage), t = norm(question), mots = t.split(' ');
    var choix = null, best = 0;
    for (var i = 0; i < SUJETS.length; i++) {
      var s = score(t, mots, SUJETS[i].kw);
      if (SUJETS[i].id === 'urgence' && s > 0) { choix = SUJETS[i]; break; }   // l'urgence passe toujours devant
      if (s > best) { best = s; choix = SUJETS[i]; }
    }
    var actions = function (ids) {
      return ids.map(function (k) { var a = A[k]; return { label: a[lang], href: a.href || (lang === 'ar' ? a.hrefAr : a.hrefFr), ext: !!a.ext }; });
    };
    if (choix) return { id: choix.id, lang: lang, texte: choix[lang](), actions: actions(choix.actions) };
    if (score(t, mots, MERCI) > 0) return { id: 'merci', lang: lang, texte: lang === 'ar' ? 'العفو، مرحبًا بكم في أي وقت.' : 'Avec plaisir. Bonne journée !', actions: [] };
    if (score(t, mots, SALUT) > 0) return { id: 'salut', lang: lang, texte: accueil(lang), actions: [] };
    var q = String(question).slice(0, 300);
    return { id: 'inconnu', lang: lang,
      texte: lang === 'ar' ? 'ليس لدي جواب أكيد على هذا السؤال. سيجيبكم الاستقبال عبر واتساب أو على الرقم 05 35 28 38 63.'
                           : 'Je n\'ai pas de réponse sûre à cette question. Le secrétariat vous répondra sur WhatsApp ou au 05 35 28 38 63.',
      actions: [{ label: A.whatsapp[lang], href: waLien((lang === 'ar' ? 'السلام عليكم، عندي سؤال: ' : 'Bonjour, j\'ai une question : ') + q), ext: false }] };
  }

  function accueil(lang) {
    return lang === 'ar'
      ? 'مرحبًا 👋 أنا مساعد عيادة الدكتور الوليد. يمكنني إرشادكم حول الأوقات، العنوان، أخذ موعد، التحضير لفحص، أو العمليات التي يجريها الدكتور. يمكنكم الكتابة بالعربية أو بالدارجة أو بالفرنسية.'
      : 'Bonjour 👋 Je suis l\'assistant du cabinet du Dr El Oualid. Je peux vous renseigner sur les horaires, l\'adresse, la prise de rendez-vous, la préparation d\'un examen ou les interventions du docteur. Vous pouvez écrire en français, en arabe ou en darija.';
  }

  global.UBFAQ = { repondre: repondre, norm: norm, accueil: accueil };

  // ── fenêtre de discussion (navigateur seulement) ──
  if (typeof document === 'undefined') return;

  function monter() {
    var langPage = (document.documentElement.lang || 'fr').slice(0, 2) === 'ar' ? 'ar' : 'fr';
    var rtl = langPage === 'ar', cote = rtl ? 'left' : 'right';
    var css = ''
      + '.ub-fab{position:fixed;' + cote + ':16px;bottom:16px;z-index:900;width:56px;height:56px;border-radius:50%;background:#0A5F6E;box-shadow:0 12px 26px rgba(10,95,110,.5);display:grid;place-items:center;cursor:pointer;border:2px solid #C9A227}'
      + '.ub-fab svg{width:25px;height:25px;fill:#fff}'
      + '.ub-fab .ub-dot{position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:#1FA855;border:2px solid #0B222A}'
      + '@media(max-width:700px){.ub-fab{bottom:76px}}'
      + '.ub-win{position:fixed;' + cote + ':16px;bottom:16px;z-index:901;width:370px;max-width:calc(100vw - 26px);height:min(590px,82vh);background:#fff;border-radius:18px;border:1px solid #E6E2D6;box-shadow:0 26px 60px rgba(8,25,32,.55);display:none;flex-direction:column;overflow:hidden;font-family:"IBM Plex Sans","Tajawal","Segoe UI",sans-serif;direction:' + (rtl ? 'rtl' : 'ltr') + '}'
      + '.ub-win.ub-open{display:flex}'
      + '.ub-h{background:#0B222A;color:#fff;padding:14px 15px;display:flex;align-items:center;gap:11px}'
      + '.ub-h .ub-av{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.12);display:grid;place-items:center;border:1px solid rgba(201,162,39,.55)}'
      + '.ub-h .ub-av svg{width:21px;height:21px;fill:#C9A227}'
      + '.ub-h b{font-size:14.5px;display:block}'
      + '.ub-h span{font-size:11px;color:#cfe0e2;display:flex;align-items:center;gap:5px}'
      + '.ub-h span i{width:7px;height:7px;border-radius:50%;background:#8ee0a8;display:inline-block}'
      + '.ub-h .ub-x{margin-' + (rtl ? 'right' : 'left') + ':auto;cursor:pointer;opacity:.85;font-size:19px;padding:4px;background:none;border:0;color:#fff}'
      + '.ub-body{flex:1;overflow-y:auto;padding:15px 13px;display:flex;flex-direction:column;gap:10px;background:#F7F4EC}'
      + '.ub-msg{max-width:86%;padding:10px 13px;border-radius:13px;font-size:14px;line-height:1.55;white-space:pre-wrap}'
      + '.ub-msg.ub-bot{background:#fff;border:1px solid #E6E2D6;align-self:flex-start;color:#16313A}'
      + '.ub-msg.ub-me{background:#0A5F6E;color:#fff;align-self:flex-end}'
      + '.ub-msg[dir=rtl]{text-align:right}'
      + '.ub-act{display:flex;flex-direction:column;gap:6px;margin-top:9px;white-space:normal}'
      + '.ub-act a{display:block;text-decoration:none;border:1px solid #0E7A8D;color:#0A5F6E;border-radius:10px;padding:8px 10px;font-weight:600;font-size:13px;text-align:center}'
      + '.ub-act a:hover{background:#0A5F6E;color:#fff}'
      + '.ub-sugg{display:flex;flex-wrap:wrap;gap:6px;padding:9px 12px;border-top:1px solid #E6E2D6;background:#fff}'
      + '.ub-sugg button{border:1px solid #E6E2D6;background:#F7F4EC;border-radius:18px;padding:6px 11px;font-size:12px;font-weight:600;color:#16313A;cursor:pointer;font-family:inherit}'
      + '.ub-sugg button:hover{border-color:#0E7A8D;color:#0A5F6E}'
      + '.ub-in{display:flex;gap:7px;padding:10px 12px;border-top:1px solid #E6E2D6;background:#fff}'
      + '.ub-in input{flex:1;min-width:0;border:1px solid #E6E2D6;border-radius:20px;padding:10px 14px;font-size:16px;font-family:inherit}'
      + '.ub-in input:focus{outline:2px solid #0E7A8D}'
      + '.ub-in button{flex:none;width:40px;height:40px;border-radius:50%;border:none;background:#0A5F6E;cursor:pointer;display:grid;place-items:center}'
      + '.ub-in button svg{width:17px;height:17px;fill:#fff' + (rtl ? ';transform:scaleX(-1)' : '') + '}'
      + '.ub-note{font-size:10.5px;color:#93A4A6;text-align:center;padding:4px 10px 8px;background:#fff}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var T = rtl
      ? { titre: 'مساعد العيادة', etat: 'أجوبة فورية', ph: 'اكتبوا سؤالكم…', note: 'معلومات عملية — لا تعوض الاستشارة الطبية.', fermer: 'إغلاق',
          sugg: ['الأوقات؟', 'فين كاينة العيادة؟', 'أخذ موعد', 'واش الدكتور كيدير العمليات؟', 'حالة مستعجلة'] }
      : { titre: 'Assistant du cabinet', etat: 'Réponses immédiates', ph: 'Écrivez votre question…', note: 'Informations pratiques — ne remplace pas une consultation.', fermer: 'Fermer',
          sugg: ['Vos horaires ?', 'Où est le cabinet ?', 'Prendre rendez-vous', 'Le docteur opère-t-il ?', 'C\'est urgent'] };

    var fab = document.createElement('div'); fab.className = 'ub-fab'; fab.id = 'ubFab'; fab.setAttribute('role', 'button'); fab.setAttribute('aria-label', T.titre); fab.tabIndex = 0;
    fab.innerHTML = '<span class="ub-dot"></span><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.3 1.1 4.4 2.9 5.9L4 21l4.2-1.6c1.2.4 2.5.6 3.8.6 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>';
    var win = document.createElement('div'); win.className = 'ub-win'; win.id = 'ubWin'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', T.titre);
    win.innerHTML = '<div class="ub-h"><div class="ub-av"><svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 20a7 7 0 0 1 14 0z"/></svg></div>'
      + '<div><b></b><span><i></i><em style="font-style:normal"></em></span></div><button class="ub-x" type="button">✕</button></div>'
      + '<div class="ub-body" id="ubBody" aria-live="polite"></div><div class="ub-sugg" id="ubSugg"></div>'
      + '<div class="ub-in"><input id="ubIn" type="text" autocomplete="off"><button type="button" id="ubGo"><svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg></button></div>'
      + '<div class="ub-note"></div>';
    win.querySelector('.ub-h b').textContent = T.titre;
    win.querySelector('.ub-h em').textContent = T.etat;
    win.querySelector('.ub-x').setAttribute('aria-label', T.fermer);
    win.querySelector('.ub-note').textContent = T.note;
    var input = win.querySelector('#ubIn'); input.placeholder = T.ph;
    document.body.appendChild(fab); document.body.appendChild(win);

    var corps = win.querySelector('#ubBody'), demarre = false;
    function bulle(cls, texte, lang, actions) {
      var d = document.createElement('div'); d.className = 'ub-msg ' + cls;
      d.setAttribute('dir', lang === 'ar' || (!lang && AR.test(texte)) ? 'rtl' : 'ltr');
      d.textContent = texte;
      if (actions && actions.length) {
        var box = document.createElement('div'); box.className = 'ub-act';
        actions.forEach(function (a) { var l = document.createElement('a'); l.href = a.href; l.textContent = a.label; if (a.ext || a.href.indexOf('https://') === 0) { l.target = '_blank'; l.rel = 'noopener'; } box.appendChild(l); });
        d.appendChild(box);
      }
      corps.appendChild(d); corps.scrollTop = corps.scrollHeight;
    }
    function poser(q) {
      q = String(q || '').trim(); if (!q) return;
      bulle('ub-me', q);
      var r = repondre(q, langPage);
      setTimeout(function () { bulle('ub-bot', r.texte, r.lang, r.actions); }, 250);
    }
    function ouvrir() {
      win.classList.add('ub-open'); fab.style.display = 'none';
      if (!demarre) {
        demarre = true; bulle('ub-bot', accueil(langPage), langPage);
        var s = win.querySelector('#ubSugg');
        T.sugg.forEach(function (q) { var b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = function () { poser(q); }; s.appendChild(b); });
      }
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
    }
    function fermer() { win.classList.remove('ub-open'); fab.style.display = 'grid'; }
    fab.onclick = ouvrir;
    fab.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } };
    win.querySelector('.ub-x').onclick = fermer;
    win.querySelector('#ubGo').onclick = function () { var v = input.value; input.value = ''; poser(v); };
    input.onkeydown = function (e) { if (e.key === 'Enter') { var v = input.value; input.value = ''; poser(v); } };
    global.ubOpen = ouvrir; global.ubClose = fermer; global.ubAsk = poser;
    if (location.hash === '#assistant') ouvrir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter();
})(this);
