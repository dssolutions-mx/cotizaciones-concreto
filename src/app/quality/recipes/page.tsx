import { redirect } from 'next/navigation';

// /quality/recipes is now unified with /masters/recipes — single recipes destination.
export default function QualityRecipesRedirect() {
  redirect('/masters/recipes');
}
