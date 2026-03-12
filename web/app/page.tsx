import { redirect } from 'next/navigation';

// Default to sales pipeline
export default function Home() {
  redirect('/sales');
}
