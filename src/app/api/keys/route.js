import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');

// Helper to ensure data directory exists
async function ensureDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Helper to ensure keys file exists
async function ensureFile() {
    await ensureDir();
    try {
        await fs.access(KEYS_FILE);
    } catch {
        await fs.writeFile(KEYS_FILE, JSON.stringify([]), 'utf8');
    }
}

async function getKeys() {
    await ensureFile();
    try {
        const data = await fs.readFile(KEYS_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading keys file:', error);
        return [];
    }
}

async function saveKeys(keys) {
    await ensureDir();
    try {
        // Write to a temporary file first then rename to prevent corruption
        const tempFile = `${KEYS_FILE}.tmp`;
        const data = JSON.stringify(keys, null, 2);
        await fs.writeFile(tempFile, data, 'utf8');
        await fs.rename(tempFile, KEYS_FILE);
    } catch (error) {
        console.error('Error saving keys file:', error);
        throw error;
    }
}

export async function GET() {
    try {
        const keys = await getKeys();
        return NextResponse.json(keys);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { label, key: rawKey } = await request.json();
        const key = rawKey?.trim();
        if (!label || !key) {
            return NextResponse.json({ error: 'Label and key are required' }, { status: 400 });
        }

        const keys = await getKeys();

        // Update existing key label or add new one
        const existingIndex = keys.findIndex(k => k.key === key);
        let newKeys;
        if (existingIndex !== -1) {
            if (keys[existingIndex].label === label) {
                return NextResponse.json(keys); // No change needed
            }
            newKeys = [...keys];
            newKeys[existingIndex] = { ...keys[existingIndex], label };
        } else {
            newKeys = [...keys, { label, key }];
        }

        await saveKeys(newKeys);
        return NextResponse.json(newKeys);
    } catch (error) {
        console.error('POST /api/keys error:', error);
        return NextResponse.json({ error: 'Failed to save key' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const keyToDelete = searchParams.get('key');

        if (!keyToDelete) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 });
        }

        const keys = await getKeys();
        const newKeys = keys.filter(k => k.key !== keyToDelete);
        await saveKeys(newKeys);
        return NextResponse.json(newKeys);
    } catch (error) {
        console.error('DELETE /api/keys error:', error);
        return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 });
    }
}
