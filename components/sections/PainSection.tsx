const processItems = [
  {
    number: "01",
    title: "Отбор",
    text: "Слушаем новые релизы и убираем все, что не держит танцпол.",
  },
  {
    number: "02",
    title: "Сортировка",
    text: "Раскладываем материал по энергии, жанру и моменту для сета.",
  },
  {
    number: "03",
    title: "Готовая подборка",
    text: "Оставляем только материал, который удобно открыть перед сетом.",
  },
];

const metrics = [
  {
    value: "7",
    label: "дней",
    text: "между обновлениями",
  },
  {
    value: "150+",
    label: "релизов",
    text: "проходит через отбор",
  },
  {
    value: "30",
    label: "минут",
    text: "на основу сета",
  },
];

export function PainSection() {
  return (
    <section className="pain-section" id="how-it-works">
      <div className="pain-kicker">
        <span>01</span>
        <span>О подходе</span>
      </div>

      <div className="pain-top">
        <h2 className="pain-title">
          Музыкальный фильтр для диджеев, которым нужен быстрый отбор
        </h2>

        <div className="pain-summary">
          <div className="pain-tag">
            Ритм и структура
          </div>

          <p>
            DJ Vault каждую неделю превращает поток новых релизов в
            качественно отобранные DJ-подборки.
          </p>

          <p>
            Вместо бесконечной прослушки ты получаешь материал, который уже
            прошел первичный фильтр и готов к работе.
          </p>
        </div>
      </div>

      <div className="pain-process">
        {processItems.map((item) => (
          <article className="pain-process-item" key={item.number}>
            <span>{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>

      <div className="pain-metrics">
        {metrics.map((metric) => (
          <div className="pain-metric" key={metric.value}>
            <strong>{metric.value}</strong>

            <div>
              <span>{metric.label}</span>
              <p>{metric.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
