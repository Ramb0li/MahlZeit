'use client';
import { useState, useEffect, useCallback } from 'react';
import { Check, Download, RefreshCw, Tag } from 'lucide-react';
import { getWeekId, nextWeek } from '@/lib/utils';
import { formatAmount } from '@/lib/utils';
import type { ShoppingList, ShoppingItem } from '@/types';

const CATEGORY_ORDER = [
  'Gemüse & Salat',
  'Hülsenfrüchte',
  'Getreide & Stärke',
  'Milchprodukte & Eier',
  'Fisch & Meeresfrüchte',
  'Tofu & Veganes',
  'Haltbare Produkte',
  'Nüsse & Samen',
  'Gewürze & Kräuter',
  'Sonstiges',
];

const STORE_COLORS = {
  migros: 'bg-orange-100 text-orange-700',
  coop: 'bg-red-100 text-red-700',
  lidl: 'bg-yellow-100 text-yellow-700',
};

export function ShoppingListView() {
  const [currentDate] = useState(new Date());
  const [shoppingList, setShoppingList] = useState<ShoppingList>({});
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [weekId] = useState(() => getWeekId(nextWeek(new Date())));

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shopping-list?weekId=${weekId}`);
      const data = await res.json();
      setShoppingList(data);
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => { loadList(); }, [loadList]);

  const toggleItem = (key: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text('Einkaufsliste – MahlZeitPlaner', 15, 20);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`KW ${weekId.split('-W')[1]} · ${new Date().toLocaleDateString('de-CH')}`, 15, 28);

    let y = 38;
    const orderedCategories = [
      ...CATEGORY_ORDER.filter((c) => shoppingList[c]),
      ...Object.keys(shoppingList).filter((c) => !CATEGORY_ORDER.includes(c)),
    ];

    for (const category of orderedCategories) {
      const items = shoppingList[category];
      if (!items?.length) continue;

      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.setFont('helvetica', 'bold');
      doc.text(category, 15, y);
      y += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      for (const item of items) {
        const itemKey = `${item.name}_${item.unit}`;
        const checked = checkedItems.has(itemKey);
        const text = `${checked ? '☑' : '☐'}  ${formatAmount(item.totalAmount, item.unit)}  ${item.name}`;
        doc.text(text, 15, y);
        y += 6;
        if (y > 270) { doc.addPage(); y = 20; }
      }
      y += 4;
    }

    doc.save(`einkaufsliste-kw${weekId.split('-W')[1]}.pdf`);
  };

  const totalItems = Object.values(shoppingList).reduce((s, items) => s + items.length, 0);
  const checkedCount = checkedItems.size;

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => shoppingList[c]),
    ...Object.keys(shoppingList).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {checkedCount} von {totalItems} erledigt
          </p>
          {totalItems > 0 && (
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full w-48 overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all"
                style={{ width: `${(checkedCount / totalItems) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadList}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
            Aktualisieren
          </button>
          {totalItems > 0 && (
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:bg-brand-green-dark transition-colors"
            >
              <Download size={14} />
              PDF
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-gray-300" />
        </div>
      )}

      {!loading && totalItems === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            Keine Einträge. Plane zuerst die Woche im Menüplan.
          </p>
        </div>
      )}

      {!loading && orderedCategories.map((category) => {
        const items = shoppingList[category];
        if (!items?.length) return null;

        return (
          <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((item) => {
                const itemKey = `${item.name}_${item.unit}`;
                const checked = checkedItems.has(itemKey);

                return (
                  <div
                    key={itemKey}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      checked ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleItem(itemKey)}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked
                        ? 'bg-brand-green border-brand-green'
                        : 'border-gray-300'
                    }`}>
                      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {item.name}
                        </span>
                        <span className={`text-sm ${checked ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatAmount(item.totalAmount, item.unit)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.promotions.map((promo, pi) => (
                          <span
                            key={pi}
                            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              STORE_COLORS[promo.store]
                            }`}
                          >
                            <Tag size={10} />
                            {promo.store.charAt(0).toUpperCase() + promo.store.slice(1)}
                            {promo.discount && ` ${promo.discount}`}
                          </span>
                        ))}
                        {item.recipeNames.length <= 2 && item.recipeNames.map((name, ri) => (
                          <span key={ri} className="text-xs text-gray-400 truncate">
                            {name}
                          </span>
                        ))}
                        {item.recipeNames.length > 2 && (
                          <span className="text-xs text-gray-400">
                            {item.recipeNames.length} Rezepte
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
