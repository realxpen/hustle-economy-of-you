// Only native platform bindings are fixtures. Better Auth/Expo plugin and HTTP are real.
const modules = {
  "react-native": 'export const Platform={OS:"android"}; export const AppState={currentState:"active",addEventListener(){return {remove(){}}}};',
  "expo-constants": 'export default {expoConfig:{scheme:"hustle-preview"}};',
  "expo-linking": 'export const createURL=(path="",options={})=>(options.scheme||"hustle-preview")+"://"+path;',
  "expo-network": 'export const addNetworkStateListener=()=>({remove(){}}); export const getNetworkStateAsync=async()=>({isConnected:true,isInternetReachable:true});'
};
export async function resolve(specifier, context, nextResolve) {
  return Object.hasOwn(modules, specifier)
    ? { url: "data:text/javascript," + encodeURIComponent(modules[specifier]), shortCircuit: true }
    : nextResolve(specifier, context);
}
