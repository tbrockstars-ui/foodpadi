import type { Metadata } from 'next';
import Link from 'next/link';
import { ReportForm } from './ReportForm';
import styles from '../dealer.module.css';

export const metadata: Metadata = { title: 'Report a listing — FoodPadi', robots: { index: false } };

export default function DealerReportPage({ params }: { params: { slug: string } }) {
  return (
    <main className={styles.page}>
      <Link href={`/dealer/${params.slug}`} className={styles.backLink}>
        <span aria-hidden="true">‹</span> Back to listing
      </Link>
      <h1 className={styles.name}>Report this listing</h1>
      <p className={styles.meta}>
        Tell us what&apos;s wrong and our team will review it. This doesn&apos;t identify you.
      </p>
      <ReportForm slug={params.slug} />
    </main>
  );
}
