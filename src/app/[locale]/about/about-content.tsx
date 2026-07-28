import styles from "@/styles/legal.module.css";

export function AboutEn() {
  return (
    <>
      <p className={styles.paragraph}>
        Emomapp tracks three dimensions of your inner life: what you make of your situation, how capable
        you feel within it, and how both change over time.
      </p>
      <p className={styles.paragraph}>
        The result is a trajectory you can step outside of and observe — something nearly impossible to do
        from inside an experience as it&apos;s happening.
      </p>
      <p className={styles.paragraph}>
        We know that patterns repeat and habits return. Emomapp helps you see it in action, sense when
        something is shifting, and understand what correlates with change.
      </p>

      <h2 className={styles.heading}>Who made it</h2>
      <p className={styles.paragraph}>
        I&apos;m Oksana Sivkovich Fagin — cognitive psychologist and professor at CUNY.
      </p>

      <p className={styles.tagline}>
        Emomapp doesn&apos;t measure how you feel. It measures how your inner state shifts.
      </p>
    </>
  );
}

export function AboutRu() {
  return (
    <>
      <p className={styles.paragraph}>
        Эмокарта проявляет твоё состояние в трёх измерениях: как ты оцениваешь сложившиеся обстоятельства,
        как ты оцениваешь своё влияние на них — и как оба этих параметра меняются со временем.
      </p>
      <p className={styles.paragraph}>
        В результате ты получаешь траекторию движения твоего состояния на карте и возможность посмотреть на
        себя со стороны.
      </p>
      <p className={styles.paragraph}>
        Многие знают, что паттерны повторяются, а привычки возвращаются. Эмокарта помогает проследить, как
        это происходит, и, возможно, изменить нежелательные сценарии.
      </p>

      <h2 className={styles.heading}>Кто создал</h2>
      <p className={styles.paragraph}>Оксана Сивкович Фейгин — когнитивный психолог и преподаватель.</p>

      <p className={styles.tagline}>
        Эмокарта измеряет не то, что ты чувствуешь. Она измеряет то, как твои чувства меняются.
      </p>
    </>
  );
}
