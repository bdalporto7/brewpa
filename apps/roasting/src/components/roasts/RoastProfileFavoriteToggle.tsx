import { toggleProfileFavorite } from "@/lib/profile-actions";
import FavoriteToggle from "@/components/ui/FavoriteToggle";

export default function RoastProfileFavoriteToggle({
  profileId,
  isFavorite,
  className,
}: {
  profileId: string;
  isFavorite: boolean;
  className?: string;
}) {
  return (
    <FavoriteToggle
      isFavorite={isFavorite}
      onToggle={() => toggleProfileFavorite(profileId, !isFavorite)}
      className={className}
    />
  );
}
