import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const cookies = req.cookies.getAll()

    return NextResponse.json({
        cookies: cookies.map(c => ({
            name: c.name,
            value: c.value.substring(0, 50) + '...', // truncate for readability
        })),
        totalCookies: cookies.length,
    })
}
