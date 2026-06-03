'use client';

// Zeitbasierter Full-Bleed-Abschnitt: zeigt je nach Tageszeit ein passendes Gericht
const DISHES = [
  {
    from: 0,  to: 10,
    tag:  'Heute Morgen',
    name: 'Cacao Smoothie Bowl',
    meta: '10 min · Vegan · Cremig & frisch',
    img:  '/images/recipes/cuiselin-cacao-smoothie-bowl.jpg',
  },
  {
    from: 10, to: 13,
    tag:  'Heute Mittag',
    name: 'Taboulé',
    meta: '20 min · Vegan · Frischer Levante-Salat',
    img:  '/images/recipes/cuiselin-taboule.jpeg',
  },
  {
    from: 13, to: 24,
    tag:  'Heute Abend',
    name: 'Pesto Genovese mit Bohnen',
    meta: '25 min · Vegetarisch · Klassiker',
    img:  '/images/recipes/cuiselin-pesto-genovese.jpg',
  },
];

export function LandingBleed() {
  const h    = new Date().getHours();
  const dish = DISHES.find(d => h >= d.from && h < d.to) ?? DISHES[2];

  return (
    <div
      className="mz-lp-bleed"
      style={{ backgroundImage: `url(${dish.img})` }}
    >
      <div className="mz-lp-bleed-card">
        <span className="mz-lp-bleed-tag">{dish.tag}</span>
        <div className="mz-lp-bleed-name">{dish.name}</div>
        <div className="mz-lp-bleed-meta">{dish.meta}</div>
      </div>
    </div>
  );
}
