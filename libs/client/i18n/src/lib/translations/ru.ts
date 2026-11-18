import type { TranslationShape } from './en';

/** Russian UI texts. Must match the key structure of `en.ts`. */
export const ru: TranslationShape = {
  app: {
    name: 'World Quiz',
  },
  common: {
    progressValue: '{{value}} из {{max}}',
  },
  toast: {
    dismiss: 'Закрыть сообщение',
  },
  notifications: {
    title: 'Сообщения',
    label: 'Сообщения',
    labelUnread: 'Сообщения, одно непрочитанное',
    empty: 'Пока ничего нового.',
    release: {
      title: 'Обновление {{version}}',
      action: 'Посмотреть, что изменилось',
    },
  },
  releaseNotes: {
    title: 'Что нового',
    version: 'Версия {{version}}',
    empty:
      'Заметки начинаются со следующего обновления: до этого экрана их никто не вёл.',
  },
  tabs: {
    label: 'Основная навигация',
    home: 'Главная',
    leaderboard: 'Рейтинг',
    achievements: 'Достижения',
    settings: 'Настройки',
  },
  tips: {
    step: 'Шаг {{current}} из {{total}}',
    next: 'Далее',
    gotIt: 'Понятно',
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
    practice: 'Работа над ошибками',
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
  nav: {
    back: 'Назад',
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
    play: {
      title: 'Игра',
      quiz: {
        title: 'Квиз',
        open: 'Играть',
      },
    },
    practice: {
      title: 'Работа над ошибками',
      emptyTitle: 'Всё чисто',
      empty: 'Ошибок пока нет. Здесь появятся страны для повторения.',
    },
    learn: {
      title: 'Обучение',
      countries: {
        title: 'Страны',
        description: 'Все страны со столицами и флагами',
        open: 'Открыть',
      },
    },
    achievements: {
      title: 'Достижения',
      seeAll: 'Все',
    },
  },
  countries: {
    title: 'Страны',
    region: 'Регион',
    legend: 'Освоенная столица или флаг отмечаются зелёной галочкой.',
    flagOf: 'Флаг {{country}}',
    mark: {
      capitals: {
        known: 'Столица: освоена',
        unknown: 'Столица: ещё не освоена',
      },
      flags: {
        known: 'Флаг: освоен',
        unknown: 'Флаг: ещё не освоен',
      },
    },
  },
  leaderboard: {
    title: 'Рейтинги',
    views: {
      global: 'Рейтинг',
      mine: 'Мои рекорды',
    },
    boardName: '{{category}} · {{region}} · {{difficulty}} · {{mode}}',
    // The same four settings in the ranking dialog, as two deliberate
    // lines: what is asked and where, then how it is played. On a phone
    // the one line wrapped after the third setting, which reads as an
    // accident; these two are a grouping.
    boardTitle: 'Рейтинг',
    boardSubject: '{{category}} · {{region}}',
    boardStyle: '{{difficulty}} · {{mode}}',
    metric: {
      fixed:
        'Ответьте правильно на {{count}} случайных вопросов быстрее остальных.',
      timed:
        'Ответьте правильно на рекордное количество вопросов за 60 секунд.',
    },
    show: 'Показать рейтинг',
    close: 'Закрыть',
    loading: 'Загружаем рейтинг…',
    loadFailed: {
      title: 'Рейтинг не загружается',
      message: 'Для рейтингов нужно соединение с сервером World Quiz.',
    },
    retry: 'Попробовать снова',
    empty: {
      title: 'Пока нет безошибочных забегов',
      message: 'Станьте первым в этом рейтинге.',
    },
    you: '(вы)',
    players: {
      one: 'В рейтинге {{count}} игрок',
      few: 'В рейтинге {{count}} игрока',
      many: 'В рейтинге {{count}} игроков',
      other: 'В рейтинге {{count}} игроков',
    },
    place: '#{{rank}} из {{players}}',
    correct: '{{correct}} верных',
    noRecords: {
      title: 'Рекордов пока нет',
      message: 'Сыграйте быстрый раунд или забег на время без единой ошибки.',
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
    howItWorks:
      'Страна считается освоенной, когда вы трижды подряд верно ответите именно по ней — в сложном режиме дважды. Ошибка обнуляет счёт по этой стране. Достижение открывается, когда освоены все страны региона.',
  },
  setup: {
    title: 'Настройка квиза',
    category: 'Тип квиза',
    categories: {
      capitals: 'Назовите столицу каждой страны',
      flags: 'Узнайте каждую страну по флагу',
    },
    scope: 'Регион',
    difficulty: 'Сложность',
    difficultyHint: {
      easy: 'Выбор из четырёх вариантов',
      hard: 'Ввод или диктовка ответа',
    },
    mode: 'Режим игры',
    modeInfo:
      'Быстрый раунд и забег на время идут в рейтинг.\n\nБесконечный режим и работа над ошибками — только для учёбы.',
    modeInfoLabel: 'О режимах игры',
    // The mark on the two modes that play against everyone else. It sits
    // on the row rather than over a group of rows.
    rankedBadge: 'Рейтинг',
    modeHint: {
      fixed: 'Вопросов: {{count}}',
      endless: 'Игра до остановки',
      timed: '60 секунд',
      practice: 'Стран на повторение: {{mistakes}}',
    },
    start: 'Начать квиз',
    play: 'Играть',
    tour: {
      category: 'Начните с типа квиза: столицы или флаги.',
      scope: 'Теперь регион — весь мир или одна его часть.',
      difficulty:
        'Дальше сложность: выбрать из четырёх вариантов или ввести ответ самому.',
      mode: 'И режим игры: раунд на несколько вопросов, бесконечный или на время.',
    },
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
    yourAnswer: 'Ваш ответ',
    tapToContinue: 'Нажмите, чтобы продолжить',
    finish: 'Завершить',
    finishEarly: 'Завершить квиз',
    unavailable: {
      title: 'Квиз недоступен',
      message:
        'Не удалось загрузить квиз. Проверьте соединение и попробуйте ещё раз.',
      back: 'На главную',
    },
  },
  practice: {
    emptyTitle: 'Повторять нечего',
    empty:
      'Здесь ошибок больше нет — все страны, в которых вы ошибались, снова освоены.',
    start: 'Повторить',
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
    board: {
      title: 'Рейтинг',
      checking: 'Проверяем рейтинг…',
      unsent:
        'Пока не в рейтинге: вы офлайн. Забег сохранён и попадёт в рейтинг при следующей синхронизации.',
      ranked: '#{{rank}} из {{players}}',
      time: 'Время: {{time}}',
      correct: '{{correct}} верных за {{time}}',
      // The two figures a record card shows under its headline.
      place: 'Место',
      answers: 'Верных',
      record: 'Новый личный рекорд!',
    },
  },
  share: {
    title: 'World Quiz',
    action: 'Поделиться результатом',
    claim: {
      record: 'Новый личный рекорд!',
      first: 'Я первый в рейтинге!',
      topThree: 'Я в тройке лучших!',
      ranked: 'Я в таблице лидеров!',
      perfect: 'Прошёл без единой ошибки!',
      plain: 'Мой результат в World Quiz',
    },
    beatMe: 'Побей мой результат',
    firstOnBoard: 'Первый результат на этой доске',
    result: {
      heading: 'World Quiz — {{category}}, {{region}}, {{difficulty}}',
      subject: '{{category}} · {{region}} · {{difficulty}}',
      score: '{{correct}}/{{answered}} верно · {{accuracy}}% · {{time}}',
    },
    record: {
      action: 'Поделиться рекордом: {{board}}',
      score: '{{score}} · {{place}}',
    },
    copied: 'Скопировано — вставьте, куда нужно.',
    failed:
      'Этот браузер не может ни поделиться результатом, ни скопировать его.',
  },
  settings: {
    title: 'Настройки',
    info: 'Подробнее: {{name}}',
    account: {
      title: 'Аккаунт',
      checking: 'Проверяем вход…',
      unverified:
        'Сервер World Quiz недоступен, поэтому вход не удаётся проверить. Проверим снова, когда появится сеть.',
      retry: 'Повторить',
      googleUnavailable:
        'Вход через Google сейчас недоступен. Проверьте соединение или блокировщик контента и обновите страницу.',
      appleOnIos: 'Вход через Apple появится в приложении для iPhone.',
      signInWithGoogle: 'Войти через Google',
      signInNotConfigured:
        'В этой сборке приложения вход через Google не настроен, поэтому войти нельзя.',
      devSignIn: 'Вход для разработки',
      appleLater:
        'Вход через Apple требует аккаунта Apple Developer и появится позже.',
      player: 'Игрок',
      signedInWith: 'Вход через {{provider}}',
      providers: {
        google: 'Google',
        apple: 'Apple',
        dev: 'аккаунт разработчика',
      },
      sync: {
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
        caughtUp: {
          one: 'Связь вернулась: {{count}} результат сохранён в аккаунте.',
          few: 'Связь вернулась: {{count}} результата сохранены в аккаунте.',
          many: 'Связь вернулась: {{count}} результатов сохранено в аккаунте.',
          other: 'Связь вернулась: {{count}} результатов сохранено в аккаунте.',
        },
      },
      nickname: {
        label: 'Публичное имя',
        edit: 'Изменить',
        save: 'Сохранить',
        saved: 'Публичное имя сохранено.',
        about: 'Так вас видят другие игроки в рейтингах.',
        invalid:
          'Такое имя не подойдёт: от 3 до 24 букв, цифр, пробелов, «_», «-» или «.».',
      },
      signOut: 'Выйти',
      delete: 'Удалить аккаунт',
      deleteTitle: 'Удалить аккаунт?',
      deleteText:
        'Аккаунт и всё, что хранится с ним на нашем сервере, будут удалены навсегда. Отменить это нельзя.',
      deleteConfirm: 'Удалить навсегда',
      deleteHint: 'Нажмите и удерживайте, пока полоса не заполнится.',
      deleteRehearsal: 'Удалить навсегда (проверка)',
      deleteRehearsalHint: 'Проверка: ничего не удаляется.',
      cancel: 'Отмена',
      signOutTitle: 'Выйти из аккаунта?',
      signOutText:
        'Результаты этого аккаунта будут удалены с этого устройства. В аккаунте они останутся и вернутся при следующем входе.',
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
      signedOut: 'Вы вышли из аккаунта.',
      deleted: 'Аккаунт и его результаты удалены.',
      errors: {
        'sign-in-failed': 'Войти не получилось. Попробуйте ещё раз.',
        unreachable: 'Сервер World Quiz недоступен. Проверьте соединение.',
        'delete-failed': 'Не удалось удалить аккаунт. Попробуйте ещё раз.',
        'nickname-invalid': 'Такое имя не подходит.',
        'nickname-failed': 'Не удалось сохранить имя. Попробуйте ещё раз.',
      },
    },
    appearance: {
      title: 'Оформление',
      light: 'Светлое',
      dark: 'Тёмное',
      system: 'Системное',
    },
    feel: {
      title: 'Звук и отклик',
      sound: 'Звуки',
      haptics: 'Вибрация',
      soundHint: 'Короткие звуки в ответ на ваши действия.',
      hapticsHint: 'Лёгкий тактильный отклик на ваши действия.',
      hapticsOnIos:
        'Вибрация работает только в приложении для iPhone: из браузера нет доступа к тактильному отклику.',
    },
    language: {
      title: 'Язык',
      en: 'Английский',
      ru: 'Русский',
    },
    tips: {
      title: 'Подсказки',
      label: 'Гид по экранам',
      hint: 'Короткий гид при первом заходе на экран. Выключается, когда вы прошли все.',
    },
    about: {
      title: 'О приложении',
      version: 'Версия',
      build: 'Сборка',
      data: 'Данные о странах',
      dataValue: 'Wikidata, UN M49',
      flags: 'Флаги',
      flagsValue: 'flag-icons (MIT)',
      whatsNew: 'Что нового',
    },
  },
};
