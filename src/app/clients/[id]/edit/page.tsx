import { Suspense } from 'react';
import EditClientForm from './EditClientForm';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id;
  
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <EditClientForm id={id} />
      </Suspense>
    </main>
  );
}
