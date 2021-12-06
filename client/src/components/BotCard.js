import { useState } from 'react'
import { Card, Input, Button, Icon, Divider, Image } from 'semantic-ui-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styled from 'styled-components';
const BotCard = ({bot}) => {
  const [gameID, setGameID] = useState("");
  const quickPlay = (dir) => {
    fetch(`/quickplay/${dir}`)
      .then((res) => res.json())
      .then((data) => {
        window.open(data.url, '_blank');
      });
  }
  const versus = (dir) => {
    fetch(`/versus`)
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
      });
  }
  const invite = (dir) => {
    fetch(`/invite/${dir}/${gameID}`)
      .then((res) => res.json())
      .then((data) => {
        toast(<StyledLink href={`${data.url}`} target="_blank" rel="noreferrer">Go to game!</StyledLink>);
      })
  }
  return (
    <Card key={bot.username}>
      <Card.Content>
        <Card.Header style={{display: 'flex', 'justify-content': 'space-between'}}>
          {bot.username}
          <Image src="/robot.png" style={{width: "33px", 'margin-top': "-8px"}} />
        </Card.Header>
        <Card.Meta>Updated {( new Date(bot.last_updated)).toLocaleString()}</Card.Meta>
        <Divider />
        <Row>
          <StyledButton primary fluid onClick={() => quickPlay(bot.dir)}>
            <Icon name="game" />
            <div>Quick Play</div>
          </StyledButton>
        </Row>
        <Row>
          <StyledButton primary fluid onClick={() => versus(bot.dir)}>
            <Icon name="game" />
            <div>1v1</div>
          </StyledButton>
        </Row>
        <Row>
          <StyledInput type="text" value={gameID} placeholder="Game ID" onChange={(e) => {setGameID(e.target.value)}}/>
          <Button secondary onClick={() => invite(bot.dir)}>Invite</Button>
        </Row>
      </Card.Content>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </Card>
  )
}

export default BotCard;

const Row = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 5px;
  box-sizing: border-box;
  flex: 1;
  width: 100%;
`;

const StyledInput = styled(Input)`
  margin-right: 4px;
`;

const StyledButton = styled(Button)`
  display: flex !important;
  flex-wrap: no-wrap !important;
  flex-direction: row !important;
  justify-content: center;
  align-items: center;
  & div {
    padding-left: 5px;
  }
`;

const StyledLink = styled.a`
  text-decoration: none;
  font-size: 16px;
  color: #000;
  &:hover {
    color: #333;
    text-decoration: underline;
  }
`