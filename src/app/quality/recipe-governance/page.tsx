import { redirect } from 'next/navigation';

// Governance is no longer a standalone destination.
// Version inspection will be embedded as a drill-through from Maestros and Lista.
export default function RecipeGovernanceRedirect() {
  redirect('/quality/recetas-hub');
}
