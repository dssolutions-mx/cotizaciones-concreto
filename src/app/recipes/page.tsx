import { redirect } from 'next/navigation';

// /recipes is the legacy SALES_AGENT route alias — unified into /masters/recipes.
export default function RecipesRedirect() {
  redirect('/masters/recipes');
}
