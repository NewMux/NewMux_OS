import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 16, fontWeight: 700, color: "#020617", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#64748b", marginBottom: 20 },
  tableHeaderRow: { flexDirection: "row", paddingVertical: 6, borderBottom: "1px solid #0f172a" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #e2e8f0", paddingVertical: 6 },
  headerCell: { fontSize: 8, textTransform: "uppercase", color: "#64748b" },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: "right" },
});

export function ReportPdf({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>NEWMUX</Text>
        <Text style={styles.subtitle}>{title} — generated {new Date().toLocaleDateString()}</Text>

        <View style={styles.tableHeaderRow}>
          {headers.map((h, i) => (
            <Text key={i} style={[i === 0 ? styles.cell : styles.cellRight, styles.headerCell]}>
              {h}
            </Text>
          ))}
        </View>
        {rows.map((row, i) => (
          <View style={styles.tableRow} key={i}>
            {row.map((cell, j) => (
              <Text key={j} style={j === 0 ? styles.cell : styles.cellRight}>
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
