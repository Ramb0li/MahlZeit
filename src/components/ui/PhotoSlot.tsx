import Image from 'next/image';
import { Sun, Star, Leaf, Flame, Sprout, Heart, Fish, Sandwich, Beef, Wheat, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface PaletteEntry {
  a: string;
  b: string;
  fg: string;
  Icon: LucideIcon;
}

const CAT_PALETTE: Record<string, PaletteEntry> = {
  'Frühstück':                  { a: '#f9e8a0', b: '#f0cc58', fg: '#7a5818', Icon: Sun },
  'Snacks & Vorspeisen':        { a: '#fde8d0', b: '#f5bb88', fg: '#8a4820', Icon: Star },
  'Salate & Bowls':             { a: '#d8f2d4', b: '#a4d8a4', fg: '#2e6836', Icon: Leaf },
  'Pasta':                      { a: '#fce4c8', b: '#f5a868', fg: '#8a3c18', Icon: Flame },
  'Suppen, Eintöpfe & Currys':  { a: '#fef0c4', b: '#f5c848', fg: '#7a5008', Icon: Flame },
  'Vegetarische Hauptgerichte': { a: '#e0f2d8', b: '#9cc898', fg: '#2e6030', Icon: Sprout },
  'Desserts & Süsses':          { a: '#fce4e8', b: '#f5a4b0', fg: '#8a2030', Icon: Heart },
  'Aufläufe & Gratins':         { a: '#ffe8d0', b: '#f5b088', fg: '#7a3018', Icon: Flame },
  'Reis & Getreide':            { a: '#f8f0c8', b: '#e8d880', fg: '#6a5010', Icon: Wheat },
  'Wraps & Sandwiches':         { a: '#deeaf8', b: '#a8c8f0', fg: '#1e4a6a', Icon: Sandwich },
  'Kartoffelgerichte':          { a: '#f0e8d4', b: '#d8c08c', fg: '#5a3c18', Icon: Flame },
  'Fisch & Meeresfrüchte':      { a: '#d4ecf8', b: '#88c4e8', fg: '#124878', Icon: Fish },
  'Fleisch & Geflügel':         { a: '#f5ddd8', b: '#e8a898', fg: '#7a2018', Icon: Beef },
  // legacy aliases
  'Süsses':                     { a: '#fce4e8', b: '#f5a4b0', fg: '#8a2030', Icon: Heart },
  'Brot & Aufstrich':           { a: '#f0e8d4', b: '#d8c08c', fg: '#5a3c18', Icon: Wheat },
};

const FALLBACK: PaletteEntry = { a: '#efe7dd', b: '#ddd0c0', fg: '#9a8a7a', Icon: BookOpen };

interface PhotoSlotProps {
  category?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PhotoSlot({ category, className, style }: PhotoSlotProps) {
  const pal = (category ? CAT_PALETTE[category] : undefined) ?? FALLBACK;
  const { Icon: IconComp } = pal;
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: `linear-gradient(145deg, ${pal.a} 0%, ${pal.b} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <IconComp size={42} style={{ color: pal.fg, opacity: 0.28 }} />
    </div>
  );
}

interface RecipeImageProps {
  imageUrl?: string | null;
  name?: string;
  category?: string;
  radius?: number;
  className?: string;
}

export function RecipeImage({ imageUrl, name, category, radius = 16, className }: RecipeImageProps) {
  if (imageUrl) {
    return (
      <div
        className={className}
        style={{ width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden', background: '#efe7dd' }}
      >
        <Image
          src={imageUrl}
          alt={name ?? ''}
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          style={{ objectFit: 'cover' }}
        />
      </div>
    );
  }
  return <PhotoSlot category={category} style={{ borderRadius: radius }} className={className} />;
}
