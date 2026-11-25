import MappingReview from "@/components/Imports/MappingReview";

type Props = {
  params: Promise<{
    companyId: string;
    mappingId: string;
  }>;
};

export default async function MappingReviewPage({ params }: Props) {
  const { companyId, mappingId } = await params;

  return <MappingReview companyId={companyId} mappingId={mappingId} />;
}
