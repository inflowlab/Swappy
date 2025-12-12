import { ErrorBanner } from '@/components/ui/banner'

export default async function IntentDetailsPage (props: { params: Promise<{ intent_id?: string }> }) {
	const { intent_id: intentId } = await props.params

	if (!intentId) {
		return (
			<ErrorBanner title='Missing intent id'>
				This route requires an <code className='font-mono'>intent_id</code> param.
			</ErrorBanner>
		)
	}

	return (
		<div className='space-y-2'>
			<h1 className='text-xl font-semibold tracking-tight'>Intent</h1>
			<p className='text-sm text-zinc-700'>
				Placeholder page for <code className='font-mono'>{intentId}</code>.
			</p>
		</div>
	)
}


