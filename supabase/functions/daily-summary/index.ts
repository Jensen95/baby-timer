import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { captureException, flush, initErrorTracking } from '../_shared/error-tracking.ts';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL')!,
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

initErrorTracking('daily-summary');

Deno.serve(async (req: Request) => {
	try {
		// Verify this is a cron or authorized request
		const authHeader = req.headers.get('Authorization');
		if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
			// Allow Supabase internal cron calls (no auth header)
			if (authHeader !== null) {
				return new Response('Unauthorized', { status: 401 });
			}
		}

		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const dayStr = yesterday.toISOString().split('T')[0];

		// Get all babies
		const { data: babies, error: babiesError } = await supabase
			.from('babies')
			.select('id, name, family_id');

		if (babiesError) {
			captureException(babiesError);
			return new Response(JSON.stringify({ error: babiesError.message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const results = [];

		for (const baby of babies ?? []) {
			const { data: summary, error: summaryError } = await supabase.rpc('daily_summary', {
				p_baby_id: baby.id,
				p_day: dayStr
			});

			if (summaryError) {
				captureException(summaryError);
				continue;
			}

			const row =
				Array.isArray(summary) && summary.length > 0
					? summary[0]
					: { feed_count: 0, feed_minutes: 0, sleep_count: 0, sleep_minutes: 0 };

			results.push({
				babyId: baby.id,
				babyName: baby.name,
				date: dayStr,
				feedCount: row.feed_count,
				feedMinutes: row.feed_minutes,
				sleepCount: row.sleep_count,
				sleepMinutes: row.sleep_minutes
			});

			console.log(
				`[${dayStr}] ${baby.name}: ${row.feed_count} feedings (${row.feed_minutes}min), ` +
					`${row.sleep_count} sleeps (${row.sleep_minutes}min)`
			);
		}

		return new Response(JSON.stringify({ date: dayStr, results }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		captureException(error);
		await flush();
		return new Response(JSON.stringify({ error: 'Unexpected error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
});
