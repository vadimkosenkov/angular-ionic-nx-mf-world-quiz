import type { TranslationShape } from './en';

/** Russian UI texts. Must match the key structure of `en.ts`. */
export const ru: TranslationShape = {
  app: {
    name: 'World Quiz',
  },
  common: {
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
  welcome: {
    tagline: 'Выучите все столицы и флаги',
    intro:
      'Войдите, чтобы играть. Прогресс сохраняется в аккаунте и доступен на всех устройствах.',
    stats: {
      countries: {
        one: 'страна',
        few: 'страны',
        many: 'стран',
        other: 'страны',
      },
      regions: {
        one: 'регион',
        few: 'региона',
        many: 'регионов',
        other: 'региона',
      },
      modes: {
        one: 'режим',
        few: 'режима',
        many: 'режимов',
        other: 'режима',
      },
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
    account: {
      title: 'Аккаунт',
      checking: 'Проверяем вход…',
      unverified:
        'Сервер World Quiz недоступен, поэтому вход не удаётся проверить. Проверим снова, когда появится сеть.',
      retry: 'Повторить',
      googleUnavailable:
        'Вход через Google сейчас недоступен. Проверьте соединение или блокировщик контента и обновите страницу.',
      appleOnIos: 'Вход через Apple появится в приложении для iPhone.',
      player: 'Игрок',
      signedInWith: 'Вход через {{provider}}',
      providers: {
        google: 'Google',
        apple: 'Apple',
        dev: 'аккаунт разработчика',
      },
      sync: {
        saved: 'Все результаты сохранены в аккаунте.',
        saving: 'Сохраняем результаты…',
        pending: {
          one: '{{count}} результат ждёт сохранения в аккаунте.',
          few: '{{count}} результата ждут сохранения в аккаунте.',
          many: '{{count}} результатов ждут сохранения в аккаунте.',
          other: '{{count}} результата ждут сохранения в аккаунте.',
        },
        rejected: {
          one: '{{count}} результат сервер не смог проверить, и он не сохранён в аккаунте.',
          few: '{{count}} результата сервер не смог проверить, и они не сохранены в аккаунте.',
          many: '{{count}} результатов сервер не смог проверить, и они не сохранены в аккаунте.',
          other:
            '{{count}} результата сервер не смог проверить, и они не сохранены в аккаунте.',
        },
        offline:
          'Нет связи с сервером World Quiz; сохранение повторится автоматически.',
      },
      signOut: 'Выйти',
      delete: 'Удалить аккаунт',
      deleteTitle: 'Удалить аккаунт?',
      deleteText:
        'Аккаунт и всё, что хранится с ним на нашем сервере, будут удалены навсегда. Отменить это нельзя.',
      deleteConfirm: 'Удалить навсегда',
      cancel: 'Отмена',
      signOutPendingTitle: 'Выйти без сохранения?',
      signOutPendingText: {
        one: '{{count}} результат, сыгранный на этом устройстве, ещё не сохранён в аккаунте. При выходе он будет удалён с устройства.',
        few: '{{count}} результата, сыгранных на этом устройстве, ещё не сохранены в аккаунте. При выходе они будут удалены с устройства.',
        many: '{{count}} результатов, сыгранных на этом устройстве, ещё не сохранены в аккаунте. При выходе они будут удалены с устройства.',
        other:
          '{{count}} результата, сыгранных на этом устройстве, ещё не сохранены в аккаунте. При выходе они будут удалены с устройства.',
      },
      signOutAnyway: 'Всё равно выйти',
      staySignedIn: 'Остаться',
      errors: {
        'sign-in-failed': 'Войти не получилось. Попробуйте ещё раз.',
        unreachable: 'Сервер World Quiz недоступен. Проверьте соединение.',
        'delete-failed': 'Не удалось удалить аккаунт. Попробуйте ещё раз.',
      },
    },
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
