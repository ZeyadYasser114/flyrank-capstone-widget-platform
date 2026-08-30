async function sendNotification(submission) {
    // simulate a 50% chance of failure, to prove resilience
    if (Math.random() < 0.5) {
        throw new Error('Simulated email provider failure');
    }
    console.log(`EMAIL: New submission received for widget ${submission.widget_id}`);
}

module.exports = { sendNotification };