export const createSpreadsheet = async (accessToken: string, title: string) => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Users' } },
        { properties: { title: 'Absensi' } }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Failed to create spreadsheet');
  return data.spreadsheetId;
};

export const initializeSheetsData = async (accessToken: string, spreadsheetId: string, initialUsers: any[]) => {
  // Add headers for Users
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A1:F1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [['ID', 'Name', 'Role', 'Password', 'Detail', 'NFC']]
    })
  });
  
  if (initialUsers.length > 0) {
    const userRows = initialUsers.map(u => [u.id, u.name, u.role, u.password || '1234', u.detail || '', u.nfcId || '']);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: userRows })
    });
  }

  // Add headers for Absensi
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Absensi!A1:I1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [['RecordID', 'MemberID', 'Type', 'Timestamp', 'Status', 'Lat', 'Lng', 'IsManualOverride', 'PhotoUrl']]
    })
  });
};

export const appendAbsensiRow = async (accessToken: string, spreadsheetId: string, row: any[]) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Absensi!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [row]
    })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to append to sheet');
  }
};

export const getAbsensiData = async (accessToken: string, spreadsheetId: string) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Absensi!A2:Z`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Absensi');
  return data.values || [];
};

export const getUsersData = async (accessToken: string, spreadsheetId: string) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:F`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Users');
  return data.values || [];
};
