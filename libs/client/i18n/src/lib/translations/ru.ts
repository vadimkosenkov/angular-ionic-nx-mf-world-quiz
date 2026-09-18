import type { TranslationShape } from './en';

/** Russian UI texts. Must match the key structure of `en.ts`. */
export const ru: TranslationShape = {
  app: {
    name: 'World Quiz',
  },
  common: {
    comingSoon: 'Скоро',
    progressValue: '{{value}} из {{max}}',
  },
  tabs: {
    label: 'Основная навигация',
    home: 'Главная',
    leaderboard: 'Рейтинг',
    achievements: 'Достижения',
    settings: 'Настройки',
  },
  categories: {
    capitals: 'Столицы',
    flags: 'Флаги',
  },
  difficulty: {
    easy: 'Лёгкий',
    hard: 'Сложный',
  },
  modes: {
    fixed: 'Быстрый раунд',
    endless: 'Бесконечный',
    timed: 'На время',
  },
  regions: {
    world: 'Весь мир',
    europe: 'Европа',
    asia: 'Азия',
    africa: 'Африка',
    'north-america': 'Северная Америка',
    'south-america': 'Южная Америка',
    oceania: 'Океания',
  },
  counts: {
    countries: {
      one: '{{count}} страна',
      few: '{{count}} страны',
      many: '{{count}} стран',
      other: '{{count}} страны',
    },
    mistakes: {
      one: '{{count}} страна для повторения',
      few: '{{count}} страны для повторения',
      many: '{{count}} стран для повторения',
      other: '{{count}} страны для повторения',
    },
    regions: {
      one: '{{count}} регион',
      few: '{{count}} региона',
      many: '{{count}} регионов',
      other: '{{count}} региона',
    },
  },
  home: {
    greeting: {
      morning: 'Доброе утро',
      afternoon: 'Добрый день',
      evening: 'Добрый вечер',
      night: 'Доброй ночи',
    },
    subtitle: 'Готовы исследовать мир?',
    progress: {
      title: 'Общий прогресс',
      caption: 'Освоено столиц и флагов',
      percent: 'Выполнено {{percent}}%',
    },
    categories: {
      title: 'Выберите категорию',
      capitals: {
        title: 'Страна → Столица',
        description: 'Назовите столицу каждой страны',
      },
      flags: {
        title: 'Флаг → Страна',
        description: 'Узнайте каждую страну по флагу',
      },
    },
    practice: {
      title: 'Работа над ошибками',
      emptyTitle: 'Всё чисто',
      empty: 'Ошибок пока нет. Здесь появятся страны для повторения.',
    },
    achievements: {
      title: 'Достижения',
      seeAll: 'Все',
    },
  },
  leaderboard: {
    title: 'Рейтинг',
    views: {
      global: 'Общий',
      mine: 'Мои рекорды',
    },
    boardsLabel: 'Категория рейтинга',
    boards: {
      'capitals-easy': 'Столицы · Лёгкий',
      'capitals-hard': 'Столицы · Сложный',
      'flags-easy': 'Флаги · Лёгкий',
      'flags-hard': 'Флаги · Сложный',
    },
    rules:
      'Правильно ответьте на вопросы обо всех странах ({{count}}). Побеждает самый быстрый забег без ошибок.',
    unavailable: {
      title: 'Рейтинги скоро появятся',
      message:
        'Общий рейтинг и личные рекорды появятся здесь, когда будут доступны вход и синхронизация.',
    },
  },
  achievements: {
    title: 'Достижения',
    summary: 'Открыто {{unlocked}} из {{total}}',
    percent: '{{percent}}%',
    statuses: {
      unlocked: 'Открыто',
      'in-progress': 'В процессе',
      locked: 'Закрыто',
    },
    name: {
      capitals: '{{scope}} · Столицы',
      flags: '{{scope}} · Флаги',
    },
    progress: 'Освоено {{mastered}} из {{total}}',
  },
  setup: {
    title: 'Настройка квиза',
    category: 'Тип квиза',
    categorySoon: 'Квизы по флагам появятся в следующем релизе.',
    scope: 'Регион',
    difficulty: 'Сложность',
    difficultyHint: {
      easy: 'Выбор из четырёх вариантов',
      hard: 'Ввод или диктовка ответа',
    },
    mode: 'Режим игры',
    modeHint: {
      fixed: 'Вопросов: {{count}}',
      endless: 'Игра до остановки',
      timed: '60 секунд',
    },
    start: 'Начать квиз',
    play: 'Играть',
  },
  quiz: {
    exit: 'Выйти из квиза',
    progress: 'Вопрос {{position}} из {{total}}',
    progressEndless: 'Вопрос {{position}}',
    score: 'Счёт',
    timeLeft: 'Осталось',
    prompt: {
      capitals: 'Какая здесь столица?',
      flags: 'Какой стране принадлежит этот флаг?',
    },
    flagLabel: 'Флаг страны из вопроса',
    answerLabel: 'Ваш ответ',
    answerPlaceholder: {
      capitals: 'Столица',
      flags: 'Название страны',
    },
    check: 'Проверить',
    emptyAnswer: 'Сначала введите ответ',
    correct: 'Верно',
    incorrect: 'Неверно',
    accepted: 'Засчитано как «{{answer}}»',
    correctAnswer: 'Правильный ответ',
    continue: 'Дальше',
    finish: 'Завершить',
    finishEarly: 'Завершить квиз',
    unavailable: {
      title: 'Квиз недоступен',
      message:
        'Не удалось загрузить квиз. Проверьте соединение и попробуйте ещё раз.',
      back: 'На главную',
    },
  },
  results: {
    title: 'Результаты',
    perfect: 'Безошибочный забег!',
    correctOf: 'Правильных: {{correct}} из {{answered}}',
    accuracy: 'Точность',
    time: 'Время',
    unlocked: 'Открыты достижения',
    review: 'Повторить',
    playAgain: 'Играть ещё',
    backHome: 'На главную',
  },
  settings: {
    title: 'Настройки',
    appearance: {
      title: 'Оформление',
      light: 'Светлое',
      dark: 'Тёмное',
      system: 'Системное',
    },
    language: {
      title: 'Язык',
      en: 'Английский',
      ru: 'Русский',
    },
    about: {
      title: 'О приложении',
      version: 'Версия',
      data: 'Данные о странах',
      dataValue: 'Wikidata, UN M49',
      flags: 'Флаги',
      flagsValue: 'flag-icons (MIT)',
    },
  },
};
