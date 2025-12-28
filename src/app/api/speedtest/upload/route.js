import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // This endpoint is just for measuring upload time
    // We don't actually need to store the file
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Simulate some processing time to make the upload test more realistic
    await new Promise(resolve => setTimeout(resolve, 100));

    return NextResponse.json({
      success: true,
      message: 'Upload test completed',
      fileSize: file.size
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
