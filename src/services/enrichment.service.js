async function enrichIp(ip) {
    try {
        const responseA = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await responseA.json();
        if (data.status === 'success') {
            return { country: data.country, city: data.city };
        }
    } catch (err) {
        // Provider A failed — fall through to Provider B
    }

    try {
        const responseB = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await responseB.json();
        if (!data.error) {
            return { country: data.country_name, city: data.city };
        }
    } catch (err) {
        // Provider B failed too — fall through to final return
    }

    return { country: null, city: null };
}

module.exports = { enrichIp };