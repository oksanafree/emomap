import styles from "@/styles/legal.module.css";

export function PrivacyPolicyEn() {
  return (
    <>
      <p className={styles.meta}>Effective date: July 2026 · Beta version</p>
      <p className={styles.meta}>Data controller: Oksana Sivkovich Fagin · oksanafagin@gmail.com</p>

      <h2 className={styles.heading}>What is Emomapp?</h2>
      <p className={styles.paragraph}>
        Emomapp is a self-reflection tool based on psychological appraisal theory. It is not a medical
        device, clinical assessment, or therapy. It is not a substitute for professional mental health
        care. It is designed for adults 18 and older.
      </p>

      <h2 className={styles.heading}>What data we collect</h2>
      <p className={styles.paragraph}>When you use Emomapp, we store:</p>
      <ul className={styles.list}>
        <li>Your email address (for login, reminders, and report notifications)</li>
        <li>
          Check-in data: two slider positions (situation and self), the resulting state, chosen emotion,
          activity context, who you were with, mental and physical engagement level, sleep hours, energy
          level, hunger level, body notes (free text), and general notes (free text)
        </li>
        <li>
          Your preferred grammatical form for Russian (masculine, feminine, or neutral) — used only for
          grammatical agreement in Russian-language reports
        </li>
        <li>Push notification tokens (optional, for reminders)</li>
        <li>Timestamps of all check-ins</li>
      </ul>
      <p className={styles.paragraph}>
        We do not request or collect GPS or precise location. Our hosting and authentication providers
        automatically process technical information — such as IP address, browser type, device
        information, and security logs — as part of normal internet operations.
      </p>

      <h2 className={styles.heading}>A note on free-text entries</h2>
      <p className={styles.paragraph}>
        Your notes and body notes are personal reflections. They may contain sensitive information about
        your mental or physical state. Please avoid including names, contact information, or identifying
        details about other people — this protects both you and them.
      </p>

      <h2 className={styles.heading}>What we send to Anthropic&apos;s Claude API</h2>
      <p className={styles.paragraph}>
        Emomapp uses Anthropic&apos;s <strong>commercial Claude API</strong> (not the consumer product) to
        generate two types of content:
      </p>
      <p className={styles.subhead}>1. State reflections</p>
      <p className={styles.paragraph}>
        After each check-in, Emomapp sends the name of your resulting state and the emotion you selected
        to Anthropic&apos;s API. Your email address, free-text notes, body notes, sleep, energy, and hunger
        data are not included in this request. State reflections are displayed after your check-in and
        are <strong>not stored</strong> in your account.
      </p>
      <p className={styles.subhead}>2. Pattern reports</p>
      <p className={styles.paragraph}>
        When generating a pattern report, Emomapp sends check-in data including coordinates, states,
        emotions, activity and social context, engagement levels, sleep, energy, hunger, body notes, and
        free-text notes. Your email address is not included. Generated reports{" "}
        <strong>are stored</strong> in your Emomapp account and remain accessible until you delete your
        account.
      </p>
      <p className={styles.subhead}>Important: Anthropic&apos;s data practices</p>
      <p className={styles.paragraph}>
        By default, Anthropic does not use inputs or outputs from its commercial API to train its AI
        models. Anthropic generally deletes API inputs and outputs from its systems within 30 days.
        However, it may retain information longer when required by law, for safety and abuse-prevention
        purposes, or when content is flagged as potentially violating its usage policies (in which case
        retention may extend to two years or more). Emomapp cannot request immediate deletion of an
        individual submission already processed by Anthropic. For more information, see{" "}
        <a href="https://anthropic.com/privacy" target="_blank" rel="noopener noreferrer">
          anthropic.com/privacy
        </a>
        .
      </p>

      <h2 className={styles.heading}>Our data processors</h2>
      <p className={styles.paragraph}>All processors are located in the United States:</p>
      <ul className={styles.list}>
        <li>
          <strong>Google Firebase</strong> — account authentication and check-in data storage
        </li>
        <li>
          <strong>Anthropic</strong> — AI state reflections and pattern reports
        </li>
        <li>
          <strong>Resend</strong> — email delivery (reminders, report notifications)
        </li>
        <li>
          <strong>Vercel</strong> — web application hosting
        </li>
      </ul>
      <p className={styles.paragraph}>
        We do not sell your data. We do not show advertisements. We do not use third-party analytics or
        session-recording tools on pages where you enter or view check-ins.
      </p>

      <h2 className={styles.heading}>Who can see your data</h2>
      <p className={styles.paragraph}>
        Your check-in data is protected by Firebase security rules that restrict database access to your
        own account.
      </p>
      <p className={styles.paragraph}>
        During the beta, the Emomapp founder may review check-in entries, notes, and generated reports
        when necessary to verify language quality, investigate technical problems, evaluate report
        accuracy, or respond to support requests. If you have concerns about this, please contact us
        before creating an account.
      </p>
      <p className={styles.paragraph}>
        We do not use your entries for research, publications, or demonstrations without your separate
        explicit consent.
      </p>

      <h2 className={styles.heading}>International data transfers</h2>
      <p className={styles.paragraph}>
        Emomapp&apos;s servers and all data processors are located in the United States. If you are in the
        European Union or United Kingdom, your data is transferred to the US. We rely on standard
        contractual clauses or equivalent legal mechanisms for these transfers where required. By using
        Emomapp, you acknowledge that your data will be processed in the United States.
      </p>

      <h2 className={styles.heading}>Your rights</h2>
      <p className={styles.paragraph}>Depending on where you live, you may have the right to:</p>
      <ul className={styles.list}>
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate data</li>
        <li>Request deletion of your account and all associated data</li>
        <li>Receive a portable copy of your data</li>
        <li>Withdraw consent (which will end your use of the service)</li>
        <li>Lodge a complaint with your national data protection authority (EU/UK residents)</li>
      </ul>
      <p className={styles.paragraph}>
        To exercise any of these rights, contact:{" "}
        <a href="mailto:oksanafagin@gmail.com">oksanafagin@gmail.com</a>
      </p>

      <h2 className={styles.heading}>Data retention and deletion</h2>
      <p className={styles.paragraph}>
        Your data is stored until you delete your account. To delete your account and all associated
        check-in data, use the Delete Account option in settings, or email{" "}
        <a href="mailto:oksanafagin@gmail.com">oksanafagin@gmail.com</a>.
      </p>
      <p className={styles.paragraph}>
        We initiate deletion within 7 days of your request. Some information may remain temporarily in
        encrypted Firebase backups or security records for up to 180 days per Google&apos;s systems.
        Information previously transmitted to Anthropic&apos;s API may be retained according to
        Anthropic&apos;s retention schedule (generally 30 days, longer in the cases described above).
      </p>

      <h2 className={styles.heading}>Security</h2>
      <p className={styles.paragraph}>
        All data is transmitted over encrypted connections (HTTPS). Firebase database security rules
        restrict access to your authenticated account.
      </p>

      <h2 className={styles.heading}>Contact and complaints</h2>
      <p className={styles.paragraph}>
        <strong>Email:</strong> <a href="mailto:oksanafagin@gmail.com">oksanafagin@gmail.com</a>
        <br />
        EU and UK residents may also lodge a complaint with their local data protection authority.
      </p>
    </>
  );
}

export function PrivacyPolicyRu() {
  return (
    <>
      <p className={styles.meta}>Дата вступления в силу: июль 2026 · Бета-версия</p>
      <p className={styles.meta}>Контролёр данных: Оксана Сивкович Фагин · oksanafagin@gmail.com</p>

      <h2 className={styles.heading}>Что такое Эмокарта?</h2>
      <p className={styles.paragraph}>
        Эмокарта — инструмент для самонаблюдения, основанный на теории психологической оценки ситуации.
        Это не медицинское устройство, не клинический инструмент и не психотерапия. Приложение не
        заменяет профессиональную психологическую помощь. Оно предназначено для пользователей старше 18
        лет.
      </p>

      <h2 className={styles.heading}>Какие данные мы собираем</h2>
      <p className={styles.paragraph}>При использовании Эмокарты мы храним:</p>
      <ul className={styles.list}>
        <li>Адрес электронной почты (для входа, напоминаний и уведомлений об отчётах)</li>
        <li>
          Данные отметок: положение двух слайдеров (обстоятельства и вы), итоговое состояние, выбранная
          эмоция, вид деятельности, окружение, уровень умственной и физической вовлечённости, часы сна,
          уровень энергии, показатель голода, заметки о теле (свободный текст) и общие заметки (свободный
          текст)
        </li>
        <li>
          Предпочтительную грамматическую форму для русскоязычных отчётов (мужской, женский или
          нейтральный род) — используется исключительно для согласования форм обращения в отчётах на
          русском языке
        </li>
        <li>Токены push-уведомлений (по желанию, для напоминаний)</li>
        <li>Временны́е метки всех отметок</li>
      </ul>
      <p className={styles.paragraph}>
        Мы не запрашиваем и не собираем данные GPS или точное местоположение. Наши провайдеры хостинга и
        аутентификации автоматически обрабатывают технические данные — IP-адрес, тип браузера, сведения об
        устройстве и журналы безопасности — в рамках обычного функционирования интернет-сервисов.
      </p>

      <h2 className={styles.heading}>Заметка о текстовых полях</h2>
      <p className={styles.paragraph}>
        Ваши заметки могут содержать личную информацию о вашем физическом или эмоциональном состоянии.
        Пожалуйста, избегайте указания имён, контактных данных и идентифицирующих сведений о других людях
        — это защищает вас и их.
      </p>

      <h2 className={styles.heading}>Что мы передаём в API Claude от Anthropic</h2>
      <p className={styles.paragraph}>
        Эмокарта использует <strong>коммерческий API Claude</strong> компании Anthropic (не потребительский
        продукт) для создания двух типов контента:
      </p>
      <p className={styles.subhead}>1. Заметки о состоянии</p>
      <p className={styles.paragraph}>
        После каждой отметки Эмокарта передаёт в API Anthropic название вашего состояния и выбранную вами
        эмоцию. Адрес электронной почты, заметки, данные о теле, сне, энергии и голоде в этот запрос не
        включаются. Заметки о состоянии отображаются после отметки и{" "}
        <strong>не сохраняются</strong> в вашем аккаунте.
      </p>
      <p className={styles.subhead}>2. Отчёты о паттернах</p>
      <p className={styles.paragraph}>
        При создании отчёта Эмокарта передаёт данные ваших отметок, включая координаты, состояния, эмоции,
        контекст деятельности и окружения, уровень вовлечённости, сон, энергию, голод, заметки о теле и
        текстовые заметки. Адрес электронной почты не включается. Созданные отчёты{" "}
        <strong>сохраняются</strong> в вашем аккаунте и остаются доступными до удаления аккаунта.
      </p>
      <p className={styles.subhead}>Важно: политика Anthropic в отношении данных</p>
      <p className={styles.paragraph}>
        По умолчанию Anthropic не использует входные данные и результаты работы своего коммерческого API
        для обучения ИИ-моделей. Как правило, Anthropic удаляет данные запросов и ответов через 30 дней.
        Однако хранение может быть продлено в случаях, предусмотренных законодательством, в целях
        обеспечения безопасности или при срабатывании автоматических систем проверки соответствия
        политикам использования (в таких случаях — до двух лет и более). Эмокарта не может запросить
        немедленное удаление отдельного запроса, уже обработанного Anthropic. Подробнее:{" "}
        <a href="https://anthropic.com/privacy" target="_blank" rel="noopener noreferrer">
          anthropic.com/privacy
        </a>
        .
      </p>

      <h2 className={styles.heading}>Наши партнёры по обработке данных</h2>
      <p className={styles.paragraph}>Все партнёры расположены в США:</p>
      <ul className={styles.list}>
        <li>
          <strong>Google Firebase</strong> — аутентификация аккаунтов и хранение данных отметок
        </li>
        <li>
          <strong>Anthropic</strong> — ИИ-заметки о состоянии и отчёты о паттернах
        </li>
        <li>
          <strong>Resend</strong> — доставка электронных писем (напоминания, уведомления об отчётах)
        </li>
        <li>
          <strong>Vercel</strong> — хостинг веб-приложения
        </li>
      </ul>
      <p className={styles.paragraph}>
        Мы не продаём ваши данные. Мы не показываем рекламу. Мы не используем сторонние средства аналитики
        или записи сессий на страницах, где вы вводите или просматриваете отметки.
      </p>

      <h2 className={styles.heading}>Кто имеет доступ к вашим данным</h2>
      <p className={styles.paragraph}>
        Ваши данные защищены правилами безопасности Firebase, которые ограничивают доступ к базе данных
        вашим аккаунтом.
      </p>
      <p className={styles.paragraph}>
        В период бета-тестирования основатель Эмокарты может просматривать отметки, заметки и созданные
        отчёты для проверки качества текстов, устранения технических проблем, оценки точности отчётов или
        ответа на обращения в поддержку. Если вас это беспокоит, пожалуйста, свяжитесь с нами до создания
        аккаунта.
      </p>
      <p className={styles.paragraph}>
        Мы не используем ваши данные в исследованиях, публикациях или презентациях без вашего отдельного
        явного согласия.
      </p>

      <h2 className={styles.heading}>Международная передача данных</h2>
      <p className={styles.paragraph}>
        Серверы Эмокарты и все партнёры по обработке данных расположены в США. Если вы находитесь в
        Европейском союзе или Великобритании, ваши данные передаются в США. Для таких передач мы используем
        стандартные договорные положения или эквивалентные правовые механизмы. Создавая аккаунт, вы
        подтверждаете, что ваши данные будут обрабатываться в США.
      </p>

      <h2 className={styles.heading}>Ваши права</h2>
      <p className={styles.paragraph}>В зависимости от страны проживания вы можете иметь право:</p>
      <ul className={styles.list}>
        <li>Получить доступ к хранимым нами персональным данным</li>
        <li>Исправить неточные данные</li>
        <li>Запросить удаление аккаунта и всех связанных данных</li>
        <li>Получить копию ваших данных</li>
        <li>Отозвать согласие (что влечёт прекращение использования сервиса)</li>
        <li>Подать жалобу в национальный орган по защите данных (для жителей ЕС и Великобритании)</li>
      </ul>
      <p className={styles.paragraph}>
        Для реализации любого из этих прав:{" "}
        <a href="mailto:oksanafagin@gmail.com">oksanafagin@gmail.com</a>
      </p>

      <h2 className={styles.heading}>Хранение и удаление данных</h2>
      <p className={styles.paragraph}>
        Данные хранятся до удаления аккаунта. Для удаления используйте опцию «Удалить аккаунт» в
        настройках или напишите на <a href="mailto:oksanafagin@gmail.com">oksanafagin@gmail.com</a>.
      </p>
      <p className={styles.paragraph}>
        Мы инициируем удаление в течение 7 дней после запроса. Часть информации может временно
        сохраняться в зашифрованных резервных копиях Firebase или журналах безопасности до 180 дней
        согласно политике Google. Данные, ранее переданные в API Anthropic, могут храниться в соответствии
        со сроками хранения Anthropic (как правило, 30 дней, в ряде случаев — дольше).
      </p>

      <h2 className={styles.heading}>Безопасность</h2>
      <p className={styles.paragraph}>
        Все данные передаются по зашифрованным соединениям (HTTPS). Правила безопасности Firebase
        ограничивают доступ к данным вашим аутентифицированным аккаунтом.
      </p>

      <h2 className={styles.heading}>Контакт и жалобы</h2>
      <p className={styles.paragraph}>
        <strong>Электронная почта:</strong>{" "}
        <a href="mailto:oksanafagin@gmail.com">oksanafagin@gmail.com</a>
        <br />
        Жители ЕС и Великобритании также вправе обратиться в местный орган по защите данных.
      </p>
    </>
  );
}
