import GroupRoom from "../../../components/group-room.jsx";
export default async function RoomPage({params}){const {id}=await params;return <GroupRoom roomId={id}/>;}
