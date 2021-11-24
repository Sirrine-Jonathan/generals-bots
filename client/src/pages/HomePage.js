import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Container, Header, Divider, Icon, Image } from 'semantic-ui-react';
import Mosaic from '../components/Mosiac';
import PageHeader from '../components/PageHeader';
import PageContainer from '../components/PageContainer';
import Loading from '../components/Loading';
import BotCard from '../components/BotCard';
const HomePage = () => {
  const [listLoading, setListLoading] = useState(true);
  const [list, setList] = useState(null);
  const getBotCards = () => {
    if (!list || list.length === undefined) return null;
    return list.map((bot, idx) => (
        <BotCard bot={bot} />
      )
    );
  }
  useEffect(() => {
    fetch("/init")
      .then((res) => res.json())
      .then((data) => {
        setList(data);
        setListLoading(false);
      })
      .catch(error => {
        setListLoading(false)
      })
  }, []);
  return (
    <PageContainer>
      <PageHeader>
          <Row>
            <h1>Generals Bots</h1>
          </Row>
          <a href="https://github.com/Sirrine-Jonathan/generals-bots.git" target="_blank" rel="noreferrer">
            <Icon name="github" style={{color: "#fff"}} size="huge" />
          </a>
      </PageHeader>
      <Container>
        <Header as="h2" style={{"paddingTop": "20px"}}>
          Explore Bots
        </Header>
        <Divider />
        {(listLoading) ? <Loading />:(
          <Mosaic>
            {getBotCards()}
          </Mosaic>
        )}
      </Container>
    </PageContainer>
  )
}
export default HomePage;

const Row = styled.div`
  display: flex;
  align-items: center;
`;