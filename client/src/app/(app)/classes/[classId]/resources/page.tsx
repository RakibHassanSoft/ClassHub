import { redirect } from 'next/navigation';

/** Resources now live in Classwork → Materials. */
export default async function ResourcesRedirect({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  redirect(`/classes/${classId}/classwork?tab=material`);
}
