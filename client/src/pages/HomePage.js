import { useEffect } from 'react'
import { Container, Header, Card, Button, Divider } from 'semantic-ui-react'
import styled from 'styled-components'
import Mosaic from '../components/Mosiac';
import PageHeader from '../components/PageHeader';
import PageContainer from '../components/PageContainer';
const HomePage = () => {
  const quickPlay = () => {
    fetch("/quickplay")
      .then((res) => res.json())
      .then((data) => console.log(data));
  }
  useEffect(() => {
    fetch("/api")
      .then((res) => res.json())
      .then((data) => console.log(data));
  }, []);
  return (
    <PageContainer>
      <PageHeader>
          <h1>Generals Bots</h1>
      </PageHeader>
      <Container>
        <Header as="h2" style={{"paddingTop": "20px"}}>
          Explore Bots
        </Header>
        <Divider />
        <Mosaic>
          <Card>
            <Card.Content>
              <Card.Header>Sirrine</Card.Header>
              <Card.Meta>Created Nov 23, 2021</Card.Meta>
              <Card.Description>
                This is the first bot created by Jon Sirrine
                <Row>
                  <StyledButton primary onClick={quickPlay}>
                    {/* <Icon name="game" /> */}
                    <div>Quick Play</div>
                  </StyledButton>
                  <StyledButton secondary>
                    {/* <Icon name="options" /> */}
                    <div>Custom Setup</div>
                  </StyledButton>
                </Row>
              </Card.Description>
            </Card.Content>
          </Card>
        </Mosaic>
      </Container>
    </PageContainer>
  )
}
export default HomePage;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: 20px;
`;

const StyledButton = styled(Button)`
  display: flex !important;
  flex-wrap: no-wrap !important;
  flex-direction: row !important;
  justify-content: center;
  align-items: center;
  & div {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
  }
`;