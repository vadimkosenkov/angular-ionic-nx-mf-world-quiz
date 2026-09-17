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
