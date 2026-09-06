import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>HUSTLE / PHASE 1</Text>
        <Text style={styles.title}>The Economy of You.</Text>
        <Text style={styles.body}>Mobile foundation ready. Product flows begin in the approved build phases.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:"#f2f0e9"},container:{flex:1,justifyContent:"center",padding:28},eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:2,color:"#555"},title:{fontSize:64,lineHeight:58,fontWeight:"800",letterSpacing:-4,marginVertical:24,color:"#111"},body:{fontSize:19,lineHeight:28,color:"#454545"}});
